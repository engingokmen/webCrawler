const express = require('express');
const app = express();
const fetch = require('node-fetch');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

class DOMretriever {
  constructor(isStyleOn,callback) { //highlight css-class adds to head of html if 'isStyleOn' is TRUE
    this.isStyleOn = isStyleOn;
    this.callback = callback;

    this.node = null;
    this.dom=null;
    this.serializedDom = null;
}

async retrievePage(url) {
  await fetch(url)
      .then(res => res.text())
      .then(body => {
        this.body = body;
        this.dom = new JSDOM(this.body);
        this.callback(this.dom);

        if(this.isStyleOn) {
          const style = this.dom.window.document.createElement('style');
          style.textContent = '.highlight {background-color: yellow;}';
          this.dom.window.document.head.append(style);

        }
        this.node = this.dom.window.document.querySelector('html');

      });
  }

  serializeDom(){
    return this.dom.serialize();
  }

}

class PageCrawler {
  constructor(keyWord,isHighlightOn,websiteUrl,updateLinksCallback) { //parentNode is highlighted if 'isHighlightOn' is TRUE   //this should be fixed
    this.keyword = keyWord;
    this.isHighlightOn = isHighlightOn;
    this.websiteUrl = websiteUrl;
    this.updateLinksCallback = updateLinksCallback;

    this.isThisPageIncludeKeyword = null;
    this.linksRelative = [];
  }

  walkOnDomTree (pNode) {
    if(this.isTextNode(pNode)) {
      if(this.isThereLink(pNode)) {
        this.recordOnlyRelativeLink(pNode);
      }
      if (this.isKeywordInside(pNode)) {
        this.isThisPageIncludeKeyword = true;
      }
    }
    for (const child of pNode.childNodes) {
      this.walkOnDomTree(child);
    }
    // console.log(this.linksRelative);
    this.updateLinksCallback(this.linksRelative);
  }

  isTextNode(pNode) {
    return (pNode.nodeType === pNode.TEXT_NODE);
  }

  isKeywordInside (pNode){
    return this.splitWordsOfElement(pNode.textContent,pNode);
  }

  splitWordsOfElement (str,pNode) {
    let words = [];
    str.replace(/[^\w\s]|_/g, "");
    words = str.split(' ');
    return this.findWordInArr(words, pNode);
  }

  // FIND WORD IN ARRAY
  findWordInArr (words, pNode) {
    for (let word of words) {
      if(word.toLowerCase()===this.keyword.toLowerCase()) {
        if(this.isHighlightOn) {
          this.highlightKeyword(pNode);
        }
        return true;
      }
    }
  }

  highlightKeyword (pNode) {
    pNode.parentNode.classList.add('highlight');
  }

  isThereLink (pNode) {
    return pNode.parentNode.hasAttribute('href');
  }

  // SOME CHEATING and ERROR HANDLING
  recordOnlyRelativeLink(pNode) {
    const href = pNode.parentNode.getAttribute('href');
    if(href.substring(0,1)!=='#' && href!=='javascript:void(0)' && href.substring(0,4)!=='http'
    && href.substring(0,3)!=='/-/' && href.substring(0,6)!=='/media'
    && href.substring(0,9)!=='/sitecore' && href.substring(0,3)!=='tel'
    && href.substring(0,3)!=='ema' && href.substring(0,3)!=='e-m' && href.substring(0,3)!=='mai') {
      this.linksRelative.push(this.websiteUrl.concat(href));
      // pNode.parentNode.setAttribute('href',this.websiteUrl.concat(href));
    }

  }

}

class WebsiteCrawler {
  constructor(keyword, websiteUrl) {
    this.keyword = keyword;
    this.websiteUrl = websiteUrl;

    this.pagesThatIncludeKeyword = [];
    this.maxPages = 9;
    this.linksRelativeUpdated = [this.websiteUrl];
    this.lenOfLinks = this.linksRelativeUpdated.length;

    this.getDom = this.getDom.bind(this);
    this.updateLinks = this.updateLinks.bind(this);
  }

  async walkOnAllPages (url) {
    for(let i=0;i<this.linksRelativeUpdated.length;i++) {
      console.log(this.pagesThatIncludeKeyword);
      if(this.pagesThatIncludeKeyword.length>this.maxPages) { // FIX WITH DO-WHILE
        break;
      }
      const nodeRetreiver = new DOMretriever(false,this.getDom);
      console.log(this.linksRelativeUpdated[i]);
      const newNode = await nodeRetreiver.retrievePage(this.linksRelativeUpdated[i]);

      const pageCrawler = new PageCrawler(this.keyword,false,this.websiteUrl,this.updateLinks);
      pageCrawler.walkOnDomTree(this.dom.window.document.querySelector('html'));

      //collect all links that include keyword
      if (pageCrawler.isThisPageIncludeKeyword) {
        if(!this.pagesThatIncludeKeyword.includes(this.linksRelativeUpdated[i])) {
          this.pagesThatIncludeKeyword.push(this.linksRelativeUpdated[i]);
        }
      }
      this.lenOfLinks = this.linksRelativeUpdated.length;
    }
  }
  getDom (dom) {
    this.dom = dom;
  }

  updateLinks(newLinks) {
    for (let i=0; i<newLinks.length;i++) {
      for (let j=0; j<this.linksRelativeUpdated.length;j++){
        if(newLinks[i]===this.linksRelativeUpdated[j]) {
          break;
        }
        else if (j===(this.linksRelativeUpdated.length-1)){
          this.linksRelativeUpdated.push(newLinks[i]);
        }
      }
    }
  }

}

//SERVER
function runServer (serializedItem) {
  app.get('/', function (req, res) {
    res.send(serializedItem);
  });

  app.listen(3000, function () {
    console.log('Routed app listening on port 3000!');
  });
}
//END SERVER

async function controller () {
    const URL = 'https://www.chevron.com';
    const KEYWORD = 'IoT';
    const websiteCrawler = new WebsiteCrawler(KEYWORD, URL); //grab the first 10 pages that contain the word “IoT”
    await websiteCrawler.walkOnAllPages(URL); //START SEARCHING THE KEYWORD IN ALL LINKS OF ALL PAGES WHICH ARE UPDATED WHEN PASS FROM ONE TO FOLLOWING PAGE...

    //render the 1st page in an html page and highlight all "IoT" words in yellow
    const dr = new DOMretriever(true,()=>{});
    console.log(websiteCrawler.pagesThatIncludeKeyword[0]);
    await dr.retrievePage(websiteCrawler.pagesThatIncludeKeyword[0]);
    const pc = new PageCrawler(KEYWORD,true,URL,()=>{}); //START HIGHLIGHTING THE FIRST PAGE WITH KEYWORD
    pc.walkOnDomTree(dr.node);

    const serializedDom = dr.serializeDom();

    console.log('\n\n                              PRINT OUT PAGE => '+websiteCrawler.pagesThatIncludeKeyword[0])
    runServer(serializedDom); //START SERVER AND PRINT OUT THE PAGE
}

controller(); //START APP
