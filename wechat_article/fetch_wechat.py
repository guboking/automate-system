#!/usr/bin/env python3
"""
Fetch WeChat article and convert to Markdown
"""

import requests
import re
import os
import json
import hashlib
from urllib.parse import urljoin, urlparse
from html.parser import HTMLParser
from html import unescape

OUTPUT_DIR = '/home/user/automate-system/wechat_article'
IMAGES_DIR = os.path.join(OUTPUT_DIR, 'images')

class WeChatParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ''
        self.author = ''
        self.publish_time = ''
        self.content_parts = []
        self.images = []

        self._in_title = False
        self._in_author = False
        self._in_content = False
        self._in_time = False
        self._tag_stack = []
        self._current_text = ''

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        tag_id = attrs_dict.get('id', '')
        tag_class = attrs_dict.get('class', '')

        self._tag_stack.append((tag, attrs_dict))

        if tag_id == 'activity-name' or 'rich_media_title' in tag_class:
            self._in_title = True
        elif tag_id == 'js_name':
            self._in_author = True
        elif tag_id == 'publish_time':
            self._in_time = True
        elif tag_id == 'js_content':
            self._in_content = True

        if self._in_content:
            if tag == 'img':
                src = attrs_dict.get('data-src') or attrs_dict.get('src', '')
                if src and not src.startswith('data:'):
                    alt = attrs_dict.get('alt', 'image')
                    self.images.append({'src': src, 'alt': alt})
                    self.content_parts.append(('img', src, alt))
            elif tag == 'br':
                self.content_parts.append(('text', '\n'))
            elif tag in ('h1', 'h2', 'h3', 'h4', 'p', 'section', 'blockquote', 'strong', 'b', 'em', 'i', 'a', 'li', 'ul', 'ol'):
                self.content_parts.append(('start', tag, attrs_dict))

    def handle_endtag(self, tag):
        if self._tag_stack:
            self._tag_stack.pop()

        if tag in ('h1', 'h2', 'h3', 'h4'):
            self._in_title = False
        if tag == 'a' and self._in_author:
            self._in_author = False
        if tag == 'em' and self._in_time:
            self._in_time = False

        if self._in_content and tag in ('h1', 'h2', 'h3', 'h4', 'p', 'section', 'blockquote', 'strong', 'b', 'em', 'i', 'a', 'li', 'ul', 'ol'):
            self.content_parts.append(('end', tag))

        # Check if we're leaving js_content
        if any(d.get('id') == 'js_content' for _, d in self._tag_stack):
            pass
        else:
            if self._in_content and tag in ('div', 'section'):
                # Check if this was the js_content div
                pass

    def handle_data(self, data):
        text = data.strip()
        if not text:
            return

        if self._in_title and not self.title:
            self.title = text
        elif self._in_author and not self.author:
            self.author = text
        elif self._in_time and not self.publish_time:
            self.publish_time = text
        elif self._in_content:
            self.content_parts.append(('text', text))


def fetch_article(url):
    """Fetch the article HTML"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
    }

    session = requests.Session()
    response = session.get(url, headers=headers, timeout=30, allow_redirects=True)
    response.raise_for_status()
    return response.text


def download_image(url, index):
    """Download image and return local path"""
    os.makedirs(IMAGES_DIR, exist_ok=True)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mp.weixin.qq.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        # Determine extension from content-type or URL
        content_type = response.headers.get('Content-Type', '')
        if 'png' in content_type:
            ext = '.png'
        elif 'gif' in content_type:
            ext = '.gif'
        elif 'webp' in content_type:
            ext = '.webp'
        else:
            ext = '.jpg'

        filename = f'image_{index:02d}{ext}'
        filepath = os.path.join(IMAGES_DIR, filename)

        with open(filepath, 'wb') as f:
            f.write(response.content)

        return f'./images/{filename}'
    except Exception as e:
        print(f'Failed to download image {index}: {e}')
        return url


def convert_to_markdown(parts, image_map):
    """Convert parsed parts to markdown"""
    md_lines = []
    tag_stack = []

    for part in parts:
        if part[0] == 'text':
            text = part[1]
            # Apply formatting based on tag stack
            if any(t in tag_stack for t in ('strong', 'b')):
                text = f'**{text}**'
            if any(t in tag_stack for t in ('em', 'i')):
                text = f'*{text}*'
            md_lines.append(text)

        elif part[0] == 'start':
            tag = part[1]
            attrs = part[2] if len(part) > 2 else {}
            tag_stack.append(tag)

            if tag == 'h1':
                md_lines.append('\n# ')
            elif tag == 'h2':
                md_lines.append('\n## ')
            elif tag == 'h3':
                md_lines.append('\n### ')
            elif tag == 'h4':
                md_lines.append('\n#### ')
            elif tag == 'p':
                md_lines.append('\n')
            elif tag == 'blockquote':
                md_lines.append('\n> ')
            elif tag == 'li':
                md_lines.append('\n- ')
            elif tag == 'a':
                href = attrs.get('href', '')
                if href:
                    md_lines.append('[')

        elif part[0] == 'end':
            tag = part[1]
            if tag in tag_stack:
                tag_stack.remove(tag)

            if tag in ('h1', 'h2', 'h3', 'h4', 'p', 'li'):
                md_lines.append('\n')
            elif tag == 'blockquote':
                md_lines.append('\n')
            elif tag == 'a':
                # Find the href from the start tag
                md_lines.append(']()')  # Simplified - href handling would need more work

        elif part[0] == 'img':
            src = part[1]
            alt = part[2] if len(part) > 2 else 'image'
            local_path = image_map.get(src, src)
            md_lines.append(f'\n![{alt}]({local_path})\n')

    # Clean up the markdown
    md = ''.join(md_lines)
    md = re.sub(r'\n{3,}', '\n\n', md)
    md = re.sub(r'^\s+', '', md)
    md = re.sub(r'\s+$', '', md)

    return md


def main():
    url = 'https://mp.weixin.qq.com/s/2idvP2rSGDcTSpqazJllog'

    print(f'Fetching article: {url}')

    try:
        html = fetch_article(url)
        print(f'Got {len(html)} bytes of HTML')

        # Save raw HTML for debugging
        with open(os.path.join(OUTPUT_DIR, 'raw.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        print('Saved raw HTML to raw.html')

        # Parse the HTML
        parser = WeChatParser()
        parser.feed(html)

        print(f'Title: {parser.title}')
        print(f'Author: {parser.author}')
        print(f'Images found: {len(parser.images)}')

        # Download images
        image_map = {}
        for i, img in enumerate(parser.images):
            print(f'Downloading image {i+1}/{len(parser.images)}...')
            local_path = download_image(img['src'], i + 1)
            image_map[img['src']] = local_path

        # Convert to markdown
        markdown = convert_to_markdown(parser.content_parts, image_map)

        # Build final document
        output = f'''# {parser.title}

> **作者**: {parser.author}
> **发布时间**: {parser.publish_time}

---

{markdown}
'''

        # Save markdown
        md_path = os.path.join(OUTPUT_DIR, 'article.md')
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f'Saved markdown to: {md_path}')

        # Save JSON data
        json_path = os.path.join(OUTPUT_DIR, 'article.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump({
                'title': parser.title,
                'author': parser.author,
                'publish_time': parser.publish_time,
                'images': parser.images,
                'url': url
            }, f, ensure_ascii=False, indent=2)

        print('Done!')

    except requests.exceptions.HTTPError as e:
        print(f'HTTP Error: {e}')
        print('WeChat article access may be restricted.')
    except Exception as e:
        print(f'Error: {e}')
        raise


if __name__ == '__main__':
    main()
