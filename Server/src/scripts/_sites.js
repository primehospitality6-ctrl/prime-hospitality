(async () => {
  const html = await (await fetch('https://stayatprime.com/')).text();
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const book = [...new Set(links)].filter((href) => /book|reserv|search|unit|listing|omega|vercel/i.test(href));
  console.log(book.slice(0, 40).join('\n'));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
