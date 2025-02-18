use std::collections::HashMap;
use std::fs::File;
use std::io::Cursor;
use std::io::Write;
use chrono::DateTime;
use chrono::Utc;
use puppylog::LogEntry;
use puppylog::LogLevel;
use puppylog::PuppylogEvent;
use puppylog::QueryAst;
use serde::Serialize;
use tokio::sync::broadcast;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;
use tokio::sync::Mutex;
use crate::config::log_path;
use crate::db::open_db;
use crate::db::NewSegmentArgs;
use crate::db::DB;
use crate::segment::LogSegment;
use crate::segment::LogSegmentArchive;
use crate::settings::Settings;
use crate::subscriber::Subscriber;
use crate::wal::load_logs_from_wal;
use crate::wal::Wal;
use crate::worker::Worker;

#[derive(Debug)]
pub struct Context {
	pub subscriber: Subscriber,
	pub publisher: Sender<LogEntry>,
	pub settings: Settings,
	pub event_tx: broadcast::Sender<PuppylogEvent>,
	pub db: DB,
	pub current: Mutex<LogSegment>,
	pub segment_archive: LogSegmentArchive,
	pub wal: Wal
}

impl Context {
	pub async fn new() -> Self {
		let (subtx, subrx) = mpsc::channel(100);
		let (pubtx, pubrx) = mpsc::channel(100);
		tokio::spawn(async move {
			Worker::new(subrx, pubrx).run().await;
		});
		let (event_tx, _) = broadcast::channel(100);
		let wal = Wal::new();
		let logs = load_logs_from_wal();
		let db = DB::new(open_db());
		let metas = db.get_segment_metadatas().await.unwrap();
		log::info!("Loaded {} metas", metas.len());
		Context {
			subscriber: Subscriber::new(subtx),
			publisher: pubtx,
			settings: Settings::load().unwrap(),
			event_tx,
			db,
			current: Mutex::new(LogSegment::with_logs(logs)),
			segment_archive: LogSegmentArchive::new(metas),
			wal
		}
	}

	pub async fn save_logs(&self, logs: &[LogEntry]) {
		let mut current = self.current.lock().await;
		for entry in logs {
			self.wal.write(entry.clone());
			current.add_log_entry(entry.clone());
			if let Err(e) = self.publisher.send(entry.clone()).await {
				log::error!("Failed to publish log entry: {}", e);
			}
		}
		if current.buffer.len() > 50_000 {
			log::info!("flushing segment wiht {} logs", current.buffer.len());
			self.wal.clear();
			let first_timestamp = current.buffer.first().unwrap().timestamp;
			let last_timestamp = current.buffer.last().unwrap().timestamp;
			let mut buff = Cursor::new(Vec::new());
			current.serialize(&mut buff);
			let original_size = buff.position() as usize;
			buff.set_position(0);
			let buff = zstd::encode_all(buff, 0).unwrap();
			let compressed_size = buff.len();
		 	let segment_id = self.db.new_segment(NewSegmentArgs {
				first_timestamp,
				last_timestamp,
				logs_count: current.buffer.len() as u64,
				original_size,
				compressed_size
			}).await.unwrap();
			let path = log_path().join(format!("{}.log", segment_id));
			let mut file = File::create(&path).unwrap();
			file.write_all(&buff).unwrap();
			// let mut encoder = zstd::Encoder::new(file, 10).unwrap();
			// encoder.write_all(&buff).unwrap();
			let old = std::mem::replace(&mut *current, LogSegment::new());
			self.segment_archive.add_segment(segment_id, old).await;
		}
	}

	pub async fn find_logs(&self, mut end: DateTime<Utc>, mut cb: impl FnMut(&LogEntry) -> bool) {
		{
			let current = self.current.lock().await;
			if current.contains_date(end) {
				let iter = current.iter(end);
				for entry in iter {
					end = entry.timestamp;
					if !cb(entry) {
						return;
					}
				}
			}
		}
		log::info!("looking from archive");
		loop {
			let segment = match self.segment_archive.get_relevant_segment(end).await {
				Some(segment) => segment,
				None => break
			};
			let iter = segment.iter(end);
			for entry in iter {
				end = entry.timestamp;
				if !cb(entry) {
					return;
				}
			}
		}
	}
}

pub struct SubscribeReq {
	pub res_tx: mpsc::Sender<LogEntry>,
	pub query: QueryAst
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeviceStatus {
	pub query: Option<String>,
	pub level: Option<LogLevel>,
	pub send_logs: bool
}