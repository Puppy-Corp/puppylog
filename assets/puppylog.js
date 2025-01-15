// ts/virtual-table.ts
class VirtualTable {
  root;
  container;
  table;
  rowHeight;
  rowCount;
  bufferSize = 10;
  needMoreRows = false;
  drawRow;
  fetchMore;
  constructor(args) {
    this.drawRow = args.drawRow;
    this.fetchMore = args.fetchMore;
    this.rowHeight = args.rowHeight;
    this.rowCount = args.rowCount;
    this.root = document.createElement("div");
    this.root.style.height = "800px";
    this.root.style.width = "100%";
    this.root.style.overflow = "auto";
    this.container = document.createElement("div");
    this.container.style.position = "relative";
    this.root.appendChild(this.container);
    this.container.style.height = `${args.rowHeight * args.rowCount}px`;
    this.container.style.width = "100%";
    this.container.style.marginBottom = "50px";
    this.container.innerHTML = "Virtual Table";
    this.table = document.createElement("table");
    this.container.appendChild(this.table);
    this.root.addEventListener("scroll", (e) => {
      this.onScroll(e);
    });
    const handleObserver = (entries) => {
      console.log("Intersection observer", entries);
    };
    const observer = new IntersectionObserver(handleObserver, {
      root: this.root,
      rootMargin: "0px",
      threshold: 0.1
    });
    setTimeout(() => {
      if (this.fetchMore)
        this.fetchMore();
    });
  }
  onScroll(e) {
    requestAnimationFrame(() => this.updateVisibleRows());
  }
  updateVisibleRows() {
    const scrollTop = this.root.scrollTop;
    const containerHeight = this.root.clientHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.bufferSize);
    const endIndex = Math.min(this.rowCount, Math.ceil((scrollTop + containerHeight) / this.rowHeight) + this.bufferSize);
    const content = this.drawRow(startIndex, endIndex);
    content.style.position = "absolute";
    content.style.top = `${startIndex * this.rowHeight}px`;
    this.container.innerHTML = "";
    this.container.appendChild(content);
    const rootRect = this.root.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const rootBottom = rootRect.bottom;
    const containerBottom = containerRect.bottom;
    if (containerBottom < rootBottom + 3 * this.rowHeight) {
      console.log("need more rows");
      if (this.needMoreRows)
        return;
      this.needMoreRows = true;
      if (this.fetchMore)
        this.fetchMore();
    }
  }
  setRowCount(rowCount) {
    console.log("Setting row count", rowCount);
    this.rowCount = rowCount;
    this.container.style.height = `${this.rowHeight * rowCount + this.rowHeight * 3}px`;
    this.updateVisibleRows();
    this.needMoreRows = false;
  }
}

// ts/logs.ts
var logColors = {
  Debug: "blue",
  Info: "green",
  Warn: "orange",
  Error: "red"
};

class Logtable {
  root;
  table = document.createElement("table");
  header;
  body;
  sortDir = "desc";
  logSearcher;
  virtual;
  constructor() {
    this.root = document.createElement("div");
    this.header = document.createElement("head");
    this.header.innerHTML = `<tr><th>Timestamp</th><th>Level</th><th>message</th></tr>`;
    this.table.appendChild(this.header);
    this.body = document.createElement("tbody");
    this.table.appendChild(this.body);
    this.logSearcher = new LogSearcher({
      onNewLoglines: this.onNewLoglines.bind(this),
      onClear: () => {
      }
    });
    this.virtual = new VirtualTable({
      rowCount: 0,
      rowHeight: 35,
      drawRow: (start, end) => {
        let body = "";
        for (let i = start;i < end; i++) {
          const r = this.logSearcher.logEntries[i];
          body += `
                    <tr style="height: 35px">
                        <td style="white-space: nowrap">${r.timestamp}</td>
                        <td style="color: ${logColors[r.level]}">${r.level}</td>
                        <td style="word-break: break-all">${r.msg}</td>
                    </tr>
                    `;
        }
        this.body.innerHTML = body;
        return this.table;
      },
      fetchMore: this.fetchMore.bind(this)
    });
    const searchOptions = new LogSearchOptions({
      searcher: this.logSearcher
    });
    this.root.appendChild(searchOptions.root);
    this.root.appendChild(this.virtual.root);
    this.logSearcher.stream();
    window.addEventListener("scroll", (e) => {
      console.log("scroll", e);
    });
  }
  onNewLoglines() {
    console.log("onNewLoglines");
    this.virtual.setRowCount(this.logSearcher.logEntries.length);
  }
  fetchMore() {
    if (!this.logSearcher)
      return;
    console.log("fetchMore");
    this.logSearcher.search({
      startDate: this.logSearcher.lastDate
    });
  }
  sort(dir) {
    this.sortDir = dir;
  }
}

class LogSearchOptions {
  root;
  input;
  button;
  startDate;
  endDate;
  searcher;
  constructor(args) {
    this.root = document.createElement("div");
    this.input = document.createElement("input");
    this.input.type = "text";
    this.button = document.createElement("button");
    this.button.onclick = () => {
      this.searcher.search({
        search: [this.input.value]
      });
    };
    this.button.innerHTML = "Search";
    this.root.appendChild(this.input);
    this.root.appendChild(this.button);
    this.startDate = document.createElement("input");
    this.startDate.type = "date";
    this.root.appendChild(this.startDate);
    this.endDate = document.createElement("input");
    this.endDate.type = "date";
    this.root.appendChild(this.endDate);
    this.searcher = args.searcher;
  }
  getQuery() {
    return this.input.value;
  }
}

class LogSearcher {
  logEventSource;
  sortDir = "desc";
  onClear;
  onNewLoglines;
  logEntries = [];
  firstDate;
  lastDate;
  constructor(args) {
    this.onClear = args.onClear;
    this.onNewLoglines = args.onNewLoglines;
  }
  stream() {
    this.createEventSource("http://localhost:3337/api/logs/stream");
  }
  search(args) {
    const query = new URLSearchParams;
    if (args.startDate) {
      query.append("startDate", args.startDate);
    }
    if (args.endDate) {
      query.append("endDate", args.endDate);
    }
    if (args.search) {
      for (const s of args.search) {
        query.append("search", s);
        this.logEntries = this.logEntries.filter((l) => {
          return l.msg.includes(s);
        });
      }
    }
    if (args.count) {
      query.append("count", args.count.toString());
    }
    const url = new URL("http://localhost:3337/api/logs");
    url.search = query.toString();
    this.onNewLoglines();
    fetch(url.toString()).then((res) => res.json()).then((data) => {
      this.logEntries.push(...data);
      this.handleSort();
      this.onNewLoglines();
    });
  }
  createEventSource(url) {
    if (this.logEventSource) {
      this.logEventSource.close();
      this.onClear();
    }
    this.logEventSource = new EventSource(url);
    this.logEventSource.onmessage = (e) => {
      console.log("Got message", e.data);
      this.logEntries.push(JSON.parse(e.data));
      this.handleSort;
      this.onNewLoglines();
    };
    this.logEventSource.onerror = (err) => {
      console.error("error", err);
      this.logEventSource?.close();
    };
  }
  handleSort() {
    if (this.sortDir === "asc")
      this.logEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    else
      this.logEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    this.firstDate = this.logEntries[0].timestamp;
    this.lastDate = this.logEntries[this.logEntries.length - 1].timestamp;
  }
}

// ts/app.ts
window.onload = () => {
  const body = document.querySelector("body");
  if (!body) {
    throw new Error("No body element found");
  }
  const t = new Logtable;
  body.appendChild(t.root);
};
