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
  let searchURL = "https://www.mercari.com/search/?itemStatuses=1&";
  searchURL += "keyword=" + encodeURIComponent(item);
  searchURL += "&sortBy=" + (sort_by === 'newest_first' ? '2' : '1');
  return searchURL;
}

class Mercari {
  async init() {
    this.browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async searchFor(item, sort_by = "best_match", max_results = 30) {
    let createURL = searchQueryConstructor(item, sort_by);
    await this.page.goto(createURL, { timeout: 0 });
    await this.page.waitForTimeout(4000);
    return await this.page.evaluate((max_results) => {
      const itemNodeList = document.querySelectorAll('[data-testid="SearchResults"]')[0].children[0].children[0].children[0].children[0];
      const serializableReturnList = [];
      for (let i = 0; i < Math.min(itemNodeList.childElementCount, max_results); i++) {
        const link = "https://www.mercari.com" + itemNodeList.children[i].children[0].getAttribute('href');
        serializableReturnList.push(link);
      }
      return serializableReturnList;
    }, max_results);
  }
}

const runBot = async () => {
  const mercari = new Mercari();
  await mercari.init();
  const items = await mercari.searchFor('ohora gel nail', 'newest_first', 30);
  const webhookURL = 'https://discord.com/api/webhooks/1102258085768208485/4Is4qyc3TVVmP14Npf9dSPbz7Me_BKziYstRSWSf0jJIhCYBNqnfWZ4ZX4EDPKOZow21';

  const sentLinksFile = 'sent_links.txt';
  let sentLinks = new Set();
  if (fs.existsSync(sentLinksFile)) {
    const fileContent = fs.readFileSync(sentLinksFile, 'utf-8');
    sentLinks = new Set(fileContent.split('\n'));
  }

  for (const link of items) {
    const trimmedLink = link.replace('/?ref=search_results', '');
    if (!sentLinks.has(trimmedLink)) {
      await sendMessageToDiscord(webhookURL, trimmedLink);
      console.log(`Link sent: ${trimmedLink}`);
      sentLinks.add(trimmedLink);
      fs.appendFileSync(sentLinksFile, trimmedLink + '\n');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  await mercari.browser.close();
};


runBot().catch(error => {
  console.error('An error occurred:', error);
});
