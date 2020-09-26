/* 
  author: Maria Saavedra
  website: www.msaavedra.com
  date: 09/04/2020
*/
const rp = require('request-promise');
const cheerio = require('cheerio');
const chalk = require('chalk');

//const url = hostname + "/explore/locations/1027572729/bar-k/";
const puppeteer = require('puppeteer');
const fs = require('fs');
const error = chalk.bold.red;
const success = chalk.keyword("green");
const config = require('./config.json');
const cookies = require('./cookies.json');
const tag = config.tag;
const hostname = "https://www.instagram.com"
const url = hostname + '/explore/tags/' + tag;
let page;
let browser;
let context;
const duration = 1000; 
const el = 'svg[aria-label="Like"]';
const comment = 'svg[aria-label="Comment"]';
const close =  'svg[aria-label="Close"]';

/* 
@TODO:
- Add start and end time for liking i.e 6AM - 6PM. 
- Make bot take a break every X hours. 
- Store instagram profiles, and already liked posts in a db.
- Create simple UI to control these variables. 
- Add multiple tags.
- Add interactions per day limit.
*/
let dailyLimit = 100;
let tags = [];
let breakDuration = 0;
let startTime = "";
let endTime = "";

const wait = (async (ms) => {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms)
  });
});

const setup = (async () => {
  browser = await puppeteer.launch({ headless: false });
  page =  await browser.newPage();
  context = await browser.createIncognitoBrowserContext();
  context.overridePermissions(hostname, []);
  await page.setDefaultNavigationTimeout(100000);
  await page.setViewport({ width: 1600, height: 1080 });
});

const login = (async () => {
  await page.goto(hostname + "/login", { waitUntil: "networkidle2" });
  await wait(3000);
  await page.type("input[name='username']", config.username, { delay: 30 })
  await page.type("input[name='password']", config.password, { delay: 30 })
  await page.click("button[type='submit']");
  await page.waitForNavigation({ waitUntil: "networkidle0" });
  console.log("logging in... one moment");
  await page.waitFor(15000);
  await writeCookies();
});


const writeComment = (async () => {
  let compliment = config.comment[Math.floor(Math.random() * config.comment.length)];
  try { 
    await page.type("textarea", compliment, { delay: 30 })
  } catch(error) {
    console.log(error);
  }
  await page.waitFor(2000);
  try { 
    await page.click("button[type='submit']");
  } catch(error) {
    console.log(error);
  }
  await page.waitFor(2000);
});

const writeCookies = (async () => {
  let currentCookies = await page.cookies();
  fs.writeFileSync('./cookies.json', JSON.stringify(currentCookies));
});

const getViewportHeight = (async () => {
  let bodyHandle = await page.$('body');
  let { height } = await bodyHandle.boundingBox();
  await bodyHandle.dispose();
  return height;
});

const getLabel = (async () => {
  let heart = '.Slqrh .QBdPU svg';
  let label;
  try {
     label = await page.$eval(heart, el => el.getAttribute('aria-label')).catch(error);
  } catch(error) {
    console.log(error);
  }
  return label;
});

const infiniteScroll = (async () => {
  let viewportHeight = page.viewport().height;
  let increment = 0;
  try {
    while (increment + viewportHeight < await getViewportHeight()) {
      await page.evaluate(_viewportHeight => {
        window.scrollBy(0, (_viewportHeight) );
      }, viewportHeight);
      increment = increment + (viewportHeight);
      await wait(duration);
    }
} catch(err){
  console.log(error(err));
}
});

(async () => {
  // wait for browser setup to finish.
  await setup(); 
  // check to see if user is logged in.
  if (!Object.keys(cookies).length) {
    try {
      login();
    } catch (err) {
      console.log("failed to login");
      process.exit(0);
    }
  } else {
      // we're already logged in
      await page.setCookie(...cookies);
      await page.goto(url, { waitUntil: "networkidle2" });

      // get all the links in the page.
      let hrefs = await page.evaluate(
        () => Array.from(
          document.querySelectorAll('a[href]'),
          a => a.getAttribute('href')
        ).filter(a => a.includes("/p/"))
      );

      // like post if we haven't already.
      for (let i = 0; 0 < 5000; i++) {
          let l;
          await page.click('a[href="' + hrefs[0] +  '"]');
          await wait(10000);
          // get aria-label from heat icon to determine if post has been liked.

          try { 
            await getLabel().then((x) => l = x);
          } catch(error) {
            console.log(error);
          }
          
          if (l === "Like") {
            //click heart icon.
            try {
              await page.click('.Slqrh .QBdPU');
            } catch(error) {
              console.log(error);
            }
            if (i % 3 === 0) {
              await writeComment();
            }
          }


          // if (i === (hrefs.length - 1)) {
          //   infiniteScroll();
          //   hrefs = await page.evaluate(
          //     () => Array.from(
          //       document.querySelectorAll('a[href]'),
          //       a => a.getAttribute('href')
          //     ).filter(a => a.includes("/p/"))
          //   );
          // }
          await wait(500);
          // click right arrow button
          await page.keyboard.press('ArrowRight');
      }

      console.log("task complete, browser closing.")
      await browser.close();
  }
})();
