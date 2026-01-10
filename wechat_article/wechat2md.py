#!/usr/bin/env python3
"""
微信公众号文章转 Markdown 工具

使用方法:
    python3 wechat2md.py <文章链接>

示例:
    python3 wechat2md.py "https://mp.weixin.qq.com/s/2idvP2rSGDcTSpqazJllog"

输出:
    ./output/article.md       - Markdown 文件
    ./output/images/          - 图片目录
"""

import requests
import re
import os
import sys
import json
from html.parser import HTMLParser

class WeChatArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ''
        self.author = ''
        self.publish_time = ''
        self.markdown = []
        self.images = []

        self._in_title = False
        self._in_author = False
        self._in_content = False
        self._in_time = False
        self._tag_stack = []
        self._format_stack = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        tag_id = attrs_dict.get('id', '')
        tag_class = attrs_dict.get('class', '')

        self._tag_stack.append(tag)

        # Detect special regions
        if tag_id == 'activity-name' or 'rich_media_title' in tag_class:
            self._in_title = True
        elif tag_id == 'js_name':
            self._in_author = True
        elif tag_id == 'publish_time' or (tag == 'em' and 'publish_time' in tag_id):
            self._in_time = True
        elif tag_id == 'js_content':
            self._in_content = True

        if self._in_content:
            if tag == 'img':
                src = attrs_dict.get('data-src') or attrs_dict.get('src', '')
                if src and not src.startswith('data:'):
                    alt = attrs_dict.get('alt', 'image')
                    self.images.append({'src': src, 'alt': alt, 'index': len(self.images)})
                    self.markdown.append(f'\n![{alt}](IMAGE_{len(self.images) - 1})\n')

            elif tag == 'br':
                self.markdown.append('\n')

            elif tag == 'p':
                self.markdown.append('\n\n')

            elif tag == 'h1':
                self.markdown.append('\n\n# ')
            elif tag == 'h2':
                self.markdown.append('\n\n## ')
            elif tag == 'h3':
                self.markdown.append('\n\n### ')
            elif tag == 'h4':
                self.markdown.append('\n\n#### ')

            elif tag in ('strong', 'b'):
                self._format_stack.append('bold')
                self.markdown.append('**')

            elif tag in ('em', 'i') and not self._in_time:
                self._format_stack.append('italic')
                self.markdown.append('*')

            elif tag == 'blockquote':
                self.markdown.append('\n\n> ')

            elif tag == 'li':
                self.markdown.append('\n- ')

            elif tag == 'a':
                href = attrs_dict.get('href', '')
                self._format_stack.append(('link', href))
                self.markdown.append('[')

            elif tag == 'code':
                self.markdown.append('`')

            elif tag == 'pre':
                self.markdown.append('\n\n```\n')

    def handle_endtag(self, tag):
        if self._tag_stack and self._tag_stack[-1] == tag:
            self._tag_stack.pop()

        # Handle title/author/time regions
        if tag in ('h1', 'h2') and self._in_title:
            self._in_title = False
        if tag == 'a' and self._in_author:
            self._in_author = False
        if tag == 'em' and self._in_time:
            self._in_time = False

        if self._in_content:
            if tag in ('strong', 'b'):
                if self._format_stack and self._format_stack[-1] == 'bold':
                    self._format_stack.pop()
                self.markdown.append('**')

            elif tag in ('em', 'i'):
                if self._format_stack and self._format_stack[-1] == 'italic':
                    self._format_stack.pop()
                self.markdown.append('*')

            elif tag == 'a':
                href = ''
                if self._format_stack and isinstance(self._format_stack[-1], tuple):
                    _, href = self._format_stack.pop()
                self.markdown.append(f']({href})')

            elif tag == 'code':
                self.markdown.append('`')

            elif tag == 'pre':
                self.markdown.append('\n```\n')

            elif tag in ('p', 'div', 'section'):
                self.markdown.append('\n')

            elif tag in ('h1', 'h2', 'h3', 'h4'):
                self.markdown.append('\n')

    def handle_data(self, data):
        text = data

        if self._in_title and not self.title:
            self.title = text.strip()
        elif self._in_author and not self.author:
            self.author = text.strip()
        elif self._in_time and not self.publish_time:
            self.publish_time = text.strip()
        elif self._in_content:
            # Clean up whitespace but preserve structure
            cleaned = re.sub(r'[\r\n]+', ' ', text)
            cleaned = re.sub(r'[ \t]+', ' ', cleaned)
            if cleaned.strip():
                self.markdown.append(cleaned)

    def get_markdown(self):
        md = ''.join(self.markdown)
        # Clean up excessive newlines
        md = re.sub(r'\n{3,}', '\n\n', md)
        md = md.strip()
        return md


def fetch_article(url):
    """Fetch article HTML with browser-like headers"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    response.encoding = 'utf-8'
    return response.text


def download_image(url, filepath):
    """Download image with referer header"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mp.weixin.qq.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    with open(filepath, 'wb') as f:
        f.write(response.content)

    return len(response.content)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    url = sys.argv[1]
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
    images_dir = os.path.join(output_dir, 'images')

    os.makedirs(images_dir, exist_ok=True)

    print(f'📥 正在获取文章: {url}')

    try:
        html = fetch_article(url)
        print(f'✓ 获取成功 ({len(html)} 字节)')

        # Parse HTML
        parser = WeChatArticleParser()
        parser.feed(html)

        print(f'📄 标题: {parser.title}')
        print(f'👤 作者: {parser.author}')
        print(f'📅 时间: {parser.publish_time}')
        print(f'🖼️  图片: {len(parser.images)} 张')

        # Download images
        image_paths = {}
        for i, img in enumerate(parser.images):
            ext = '.jpg'  # Default
            if 'png' in img['src']:
                ext = '.png'
            elif 'gif' in img['src']:
                ext = '.gif'
            elif 'webp' in img['src']:
                ext = '.webp'

            filename = f'image_{i+1:02d}{ext}'
            filepath = os.path.join(images_dir, filename)

            try:
                print(f'  ⬇️  下载图片 {i+1}/{len(parser.images)}...', end='', flush=True)
                size = download_image(img['src'], filepath)
                print(f' ✓ ({size} bytes)')
                image_paths[f'IMAGE_{i}'] = f'./images/{filename}'
            except Exception as e:
                print(f' ✗ ({e})')
                image_paths[f'IMAGE_{i}'] = img['src']

        # Replace image placeholders
        markdown = parser.get_markdown()
        for placeholder, path in image_paths.items():
            markdown = markdown.replace(placeholder, path)

        # Build final document
        output = f'''# {parser.title}

> **作者**: {parser.author}
> **发布时间**: {parser.publish_time}
> **原文链接**: {url}

---

{markdown}
'''

        # Save markdown
        md_path = os.path.join(output_dir, 'article.md')
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(output)

        print(f'\n✅ 完成!')
        print(f'   📄 Markdown: {md_path}')
        print(f'   🖼️  图片目录: {images_dir}')

    except requests.exceptions.HTTPError as e:
        print(f'❌ HTTP 错误: {e}')
        print('   可能原因: 文章已删除、需要登录、或访问受限')
        sys.exit(1)
    except Exception as e:
        print(f'❌ 错误: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
