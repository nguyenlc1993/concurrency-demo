const { Worker, isMainThread, parentPort } = require('worker_threads');

setInterval(() => {
  console.log("ALIVE");
}, 100);

function blockingTask() {
  let result = 0;
  for (let i = 0; i < 10000000000; i++) {
    result += i;
  }
  return result;
}

if (isMainThread) {
  const worker = new Worker(__filename);
  worker.postMessage('start');
  worker.on('message', (message) => {
    console.log(`Result: ${message}`);
  });
} else {
  parentPort.on('message', (message) => {
    if (message === 'start') {
      const result = blockingTask();
      parentPort.postMessage(result);
    }
  });
}
