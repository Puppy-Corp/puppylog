class n{root;header;body;sortDir="desc";constructor(){this.root=document.createElement("table"),this.header=document.createElement("tr"),this.header.innerHTML="<th>Timestamp</th><th>message</th>",this.root.appendChild(this.header),this.body=document.createElement("tbody"),this.root.appendChild(this.body),fetch("http://localhost:3000/api/logs?count=10").then((t)=>t.json()).then((t)=>{this.addRows(t)})}addRows(t){console.log("Adding rows",t);for(let o of t){let e=document.createElement("tr");if(e.innerHTML=`<td>${o.timestamp}</td><td>${o.message}</td>`,this.sortDir==="asc")this.body.prepend(e);else this.body.appendChild(e)}}sort(t){this.sortDir=t}}class r{root;input;button;startDate;endDate;constructor(){this.root=document.createElement("div"),this.input=document.createElement("input"),this.input.type="text",this.button=document.createElement("button"),this.button.innerHTML="Search",this.root.appendChild(this.input),this.root.appendChild(this.button),this.startDate=document.createElement("input"),this.startDate.type="date",this.root.appendChild(this.startDate),this.endDate=document.createElement("input"),this.endDate.type="date",this.root.appendChild(this.endDate)}getQuery(){return this.input.value}}window.onload=()=>{let t=document.querySelector("body");if(!t)throw new Error("No body element found");let o=new r,e=new n;t.appendChild(o.root),t.appendChild(e.root)};
