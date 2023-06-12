const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

async function sendMessageToDiscord(webhookURL, message) {
  const requestBody = {
    content: message,
  };

  const response = await fetch(webhookURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Error sending message to Discord: ${response.statusText}`);
  }
}

const searchQueryConstructor = (item, sort_by) => {
  let searchURL = "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(item);
  searchURL += "&_sop=" + (sort_by === 'newest_first' ? '10' : '12');
  return searchURL;
}

class Ebay {
  async init() {
    this.browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async searchFor(item, sort_by = "best_match", max_results = 30) {
    let createURL = searchQueryConstructor(item, sort_by);
    await this.page.goto(createURL, { timeout: 0 });
    await this.page.waitForTimeout(4000);
    return await this.page.evaluate((max_results) => {
      const itemNodeList = document.querySelectorAll('.s-item');
      const serializableReturnList = [];
      for (let i = 0; i < Math.min(itemNodeList.length, max_results); i++) {
        const link = itemNodeList[i].querySelector('a').getAttribute('href').split('?')[0];
        serializableReturnList.push(link);
      }
      return serializableReturnList;
    }, max_results);
  }
}

const runBot = async () => {
  const ebay = new Ebay();
  await ebay.init();
  const items = await ebay.searchFor('ohora gel nail', 'newest_first', 30);
  const webhookURL = 'https://discord.com/api/webhooks/1102245500687757322/agejD-0XuX_XLgVHe_QdHk0vxPly_lEbOOrpYMp-HT14h_CqPoZc2TbgtT-JGDp6r0jh';

  const sentLinksFile = 'sent_links.txt';
  let sentLinks = new Set();
  if (fs.existsSync(sentLinksFile)) {
    const fileContent = fs.readFileSync(sentLinksFile, 'utf-8');
    sentLinks = new Set(fileContent.split('\n').filter(link => link.trim() !== '')); // Filter out empty lines
  }

  for (const link of items) {
    if (!sentLinks.has(link)) {
      await sendMessageToDiscord(webhookURL, link);
      console.log(`Link sent: ${link}`);
      sentLinks.add(link);
      fs.appendFileSync(sentLinksFile, link + '\n');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  await ebay.browser.close();
};

runBot().catch(error => {
  console.error('An error occurred:', error);
});
