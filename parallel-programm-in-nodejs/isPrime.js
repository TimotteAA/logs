function isPrime(num) {
  const factors = [];

  if (num < 1) return false;
  if (num === 1) return true;

  for (let i = 2; i < num; i++) {
    if (num % i === 0) {
      factors.push(i);
    }
  }

  return { num, factors, isPrime: factors.length > 0 ? false : true };
}

/**
 * 监听父进程的消息
 */
process.on("message", (message) => {
  const { num } = message;
  if (isNaN(+num)) {
    // throw new Error("parent num is not a number");
    process.send({ type: "error" });
    process.exit(1);
  }

  const result = isPrime(+num);
  console.log("result", result);
  process.send({ type: "result", result });
  process.exit(0);
});
