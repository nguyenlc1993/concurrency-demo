setInterval(() => {
  console.log("ALIVE");
}, 100);

function blockingTask() {
  let result = 0;
  for (let i = 0; i < 10000000000; i++) {
    result += i;
  }
  console.log("blockingTask completed");
}

(async () => {
  blockingTask();
})();