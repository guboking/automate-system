// Apify Actor 配置 - 预定义常用数据抓取 Actor

export interface ActorConfig {
  id: string;
  name: string;
  description: string;
  defaultInput: Record<string, unknown>;
  resultMapper?: (raw: unknown) => unknown;
}

// 常用 Actor 列表
export const APIFY_ACTORS: Record<string, ActorConfig> = {
  // Google 搜索抓取
  'google-search': {
    id: 'apify/google-search-scraper',
    name: 'Google Search Scraper',
    description: '抓取 Google 搜索结果，获取网页标题、链接和摘要',
    defaultInput: {
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      languageCode: 'zh-CN',
      mobileResults: false,
    },
  },

  // Google Maps 商户信息抓取
  'google-maps': {
    id: 'compass/crawler-google-places',
    name: 'Google Maps Scraper',
    description: '抓取 Google Maps 商户信息，包括评分、地址、联系方式',
    defaultInput: {
      maxCrawledPlacesPerSearch: 20,
      language: 'zh-CN',
    },
  },

  // 网页内容抓取
  'web-scraper': {
    id: 'apify/web-scraper',
    name: 'Web Scraper',
    description: '通用网页内容抓取器，支持自定义选择器',
    defaultInput: {
      maxRequestsPerCrawl: 10,
      maxConcurrency: 5,
    },
  },

  // TikTok 数据抓取
  'tiktok-scraper': {
    id: 'clockworks/free-tiktok-scraper',
    name: 'TikTok Scraper',
    description: '抓取 TikTok 视频和用户数据',
    defaultInput: {
      resultsPerPage: 20,
    },
  },

  // Amazon 产品数据
  'amazon-scraper': {
    id: 'junglee/amazon-crawler',
    name: 'Amazon Product Scraper',
    description: '抓取 Amazon 产品信息，包括价格、评价、描述',
    defaultInput: {
      maxItems: 20,
    },
  },

  // Twitter/X 数据抓取
  'twitter-scraper': {
    id: 'apidojo/tweet-scraper',
    name: 'Twitter/X Scraper',
    description: '抓取 Twitter/X 推文和用户数据',
    defaultInput: {
      maxItems: 50,
      sort: 'Latest',
    },
  },

  // YouTube 数据抓取
  'youtube-scraper': {
    id: 'bernardo/youtube-scraper',
    name: 'YouTube Scraper',
    description: '抓取 YouTube 视频信息和评论',
    defaultInput: {
      maxResults: 20,
    },
  },

  // LinkedIn 公司信息
  'linkedin-scraper': {
    id: 'anchor/linkedin-company-scraper',
    name: 'LinkedIn Company Scraper',
    description: '抓取 LinkedIn 公司页面信息',
    defaultInput: {
      maxItems: 10,
    },
  },

  // 财经新闻抓取（通用 RSS）
  'rss-feed': {
    id: 'dtrungtin/rss-feed-reader',
    name: 'RSS Feed Reader',
    description: '读取 RSS 订阅源，获取最新文章',
    defaultInput: {
      maxItems: 30,
    },
  },

  // 通用 API 抓取
  'cheerio-scraper': {
    id: 'apify/cheerio-scraper',
    name: 'Cheerio Scraper',
    description: '轻量级 HTML 解析抓取器，适合静态页面',
    defaultInput: {
      maxRequestsPerCrawl: 20,
      maxConcurrency: 10,
    },
  },

  // 雪球财经数据（自定义 URL 抓取）
  'xueqiu-scraper': {
    id: 'apify/cheerio-scraper',
    name: 'Xueqiu Finance Scraper',
    description: '抓取雪球财经网站的股票数据和讨论',
    defaultInput: {
      startUrls: [],
      maxRequestsPerCrawl: 5,
    },
  },

  // Yahoo Finance 数据
  'yahoo-finance': {
    id: 'apify/cheerio-scraper',
    name: 'Yahoo Finance Scraper',
    description: '抓取 Yahoo Finance 的股票行情和财务数据',
    defaultInput: {
      startUrls: [],
      maxRequestsPerCrawl: 5,
    },
  },
};

// Actor 搜索：根据关键词找到最合适的 Actor
export function findBestActor(query: string): ActorConfig | null {
  const lowerQuery = query.toLowerCase();

  const keywords: Record<string, string[]> = {
    'google-search': ['google', '搜索', 'search', '谷歌'],
    'google-maps': ['地图', 'maps', '商户', '店铺', 'restaurant', 'place'],
    'web-scraper': ['网页', '网站', 'website', 'web', 'scrape', '抓取'],
    'tiktok-scraper': ['tiktok', '抖音', '短视频'],
    'amazon-scraper': ['amazon', '亚马逊', '产品', 'product'],
    'twitter-scraper': ['twitter', 'x.com', '推特', 'tweet'],
    'youtube-scraper': ['youtube', '油管', 'video', '视频'],
    'linkedin-scraper': ['linkedin', '领英', 'company', '公司信息'],
    'rss-feed': ['rss', '订阅', 'feed', '新闻源'],
    'cheerio-scraper': ['html', '解析', 'parse', '静态'],
    'xueqiu-scraper': ['雪球', 'xueqiu'],
    'yahoo-finance': ['yahoo', 'finance', '雅虎'],
  };

  for (const [actorKey, keywordList] of Object.entries(keywords)) {
    if (keywordList.some(kw => lowerQuery.includes(kw))) {
      return APIFY_ACTORS[actorKey] || null;
    }
  }

  return null;
}
