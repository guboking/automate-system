const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const url = process.argv[2] || 'https://mp.weixin.qq.com/s/2idvP2rSGDcTSpqazJllog';
const outputDir = '/home/user/automate-system/wechat_article';
const imagesDir = path.join(outputDir, 'images');

async function downloadImage(imgUrl, filename) {
    return new Promise((resolve, reject) => {
        const protocol = imgUrl.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://mp.weixin.qq.com/'
            }
        };

        protocol.get(imgUrl, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location, filename).then(resolve).catch(reject);
                return;
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.writeFileSync(filename, buffer);
                resolve(filename);
            });
            response.on('error', reject);
        }).on('error', reject);
    });
}

(async () => {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'zh-CN'
    });

    const page = await context.newPage();

    console.log('Fetching article:', url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for content to load
    await page.waitForSelector('#js_content', { timeout: 10000 }).catch(() => {});

    // Extract article data
    const article = await page.evaluate(() => {
        const title = document.querySelector('#activity-name')?.textContent?.trim() ||
                     document.querySelector('.rich_media_title')?.textContent?.trim() || '';
        const author = document.querySelector('#js_name')?.textContent?.trim() ||
                      document.querySelector('.rich_media_meta_nickname')?.textContent?.trim() || '';
        const publishTime = document.querySelector('#publish_time')?.textContent?.trim() ||
                           document.querySelector('.rich_media_meta_text')?.textContent?.trim() || '';

        const content = document.querySelector('#js_content');

        // Get all images
        const images = [];
        if (content) {
            content.querySelectorAll('img').forEach((img, idx) => {
                const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
                if (src && !src.includes('data:image')) {
                    images.push({ index: idx, src: src, alt: img.alt || '' });
                }
            });
        }

        // Convert content to simplified HTML
        function processNode(node, depth = 0) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = node.tagName.toLowerCase();
            let result = '';

            // Skip hidden elements
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return '';

            // Process children
            let childContent = '';
            node.childNodes.forEach(child => {
                childContent += processNode(child, depth + 1);
            });

            switch (tag) {
                case 'h1': return `\n# ${childContent.trim()}\n`;
                case 'h2': return `\n## ${childContent.trim()}\n`;
                case 'h3': return `\n### ${childContent.trim()}\n`;
                case 'h4': return `\n#### ${childContent.trim()}\n`;
                case 'p': return `\n${childContent.trim()}\n`;
                case 'br': return '\n';
                case 'strong': case 'b': return `**${childContent}**`;
                case 'em': case 'i': return `*${childContent}*`;
                case 'blockquote': return `\n> ${childContent.trim().replace(/\n/g, '\n> ')}\n`;
                case 'ul': return `\n${childContent}`;
                case 'ol': return `\n${childContent}`;
                case 'li': return `- ${childContent.trim()}\n`;
                case 'a':
                    const href = node.getAttribute('href') || '';
                    return href ? `[${childContent}](${href})` : childContent;
                case 'img':
                    const src = node.getAttribute('data-src') || node.getAttribute('src') || '';
                    const alt = node.alt || 'image';
                    return src ? `\n![${alt}](${src})\n` : '';
                case 'section': case 'div': case 'span':
                    return childContent;
                default:
                    return childContent;
            }
        }

        const markdown = content ? processNode(content) : '';

        return { title, author, publishTime, markdown, images };
    });

    console.log('Title:', article.title);
    console.log('Author:', article.author);
    console.log('Images found:', article.images.length);

    // Create images directory
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Download images
    const imageMap = {};
    for (let i = 0; i < article.images.length; i++) {
        const img = article.images[i];
        const ext = '.jpg'; // Default to jpg
        const filename = `image_${String(i + 1).padStart(2, '0')}${ext}`;
        const filepath = path.join(imagesDir, filename);

        try {
            console.log(`Downloading image ${i + 1}/${article.images.length}...`);
            await downloadImage(img.src, filepath);
            imageMap[img.src] = `./images/${filename}`;
        } catch (e) {
            console.log(`Failed to download image ${i + 1}:`, e.message);
            imageMap[img.src] = img.src; // Keep original URL
        }
    }

    // Replace image URLs in markdown
    let finalMarkdown = article.markdown;
    for (const [oldUrl, newPath] of Object.entries(imageMap)) {
        finalMarkdown = finalMarkdown.split(oldUrl).join(newPath);
    }

    // Clean up markdown
    finalMarkdown = finalMarkdown
        .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
        .replace(/^\s+|\s+$/g, '');   // Trim

    // Build final document
    const output = `# ${article.title}

> **作者**: ${article.author}
> **发布时间**: ${article.publishTime}

---

${finalMarkdown}
`;

    // Save markdown
    const mdPath = path.join(outputDir, 'article.md');
    fs.writeFileSync(mdPath, output, 'utf-8');
    console.log('Saved markdown to:', mdPath);

    // Save raw data as JSON
    const jsonPath = path.join(outputDir, 'article.json');
    fs.writeFileSync(jsonPath, JSON.stringify(article, null, 2), 'utf-8');

    await browser.close();
    console.log('Done!');
})();
