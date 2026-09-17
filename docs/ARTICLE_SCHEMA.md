# ArticleDocument

Schema Version: 1.0

Produced by `FactIt.normalizeArticle` (extension/content/normalize.js)
from the raw result of `FactIt.extractArticle`. Deterministic: the same
page content yields the same document and the same `content_hash`.

```
{
  "schema_version": "1.0",
  "content_hash": "<sha256 hex of document.content>",
  "document": {
    "url": "https://example.com/story",
    "domain": "example.com",
    "title": "",
    "author": null,
    "published_at": null,
    "language": null,
    "content": "",
    "truncated": false,
    "links": [],
    "images": []
  }
}
```

## Fields

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | `"1.0"` |
| `content_hash` | string | SHA-256 (lowercase hex) of `document.content`. Independent of URL and metadata, so the same article at two URLs hashes identically. Cache key for V0.8. |
| `document.url` | string | Canonical http(s) URL: no fragment, no credentials, tracking parameters (`utm_*`, `fbclid`, `gclid`, ...) removed. |
| `document.domain` | string | Hostname of `url`, lowercase. |
| `document.title` | string | Whitespace-collapsed, max 300 chars. May be empty. |
| `document.author` | string or null | Byline as published (may be a publisher name, not a person). Max 200 chars. |
| `document.published_at` | string or null | ISO 8601 UTC, or null when absent or unparseable. |
| `document.language` | string or null | Canonical BCP-47 tag (`en`, `pt-BR`), or null. |
| `document.content` | string | Plain text, never HTML. NFC-normalized; control, zero-width and bidi-control characters removed; whitespace collapsed per line; blank lines removed; paragraphs separated by `\n`. Max 40,000 chars. |
| `document.truncated` | boolean | True when `content` was cut at the size limit (on a line boundary). |
| `document.links` | array | `{ href, text }`. Only links from inside the extracted article; http(s) only, normalized like `url`, deduplicated, max 50. `text` max 200 chars. |
| `document.images` | array | `{ src, alt, caption }`. Metadata only; images are never fetched. http(s) only, deduplicated, max 20. `alt`/`caption` max 300 chars. |

Insufficient metadata is normal. `null` and empty values are valid.

## Links

Possible future classifications:

SOURCE
REFERENCE
INTERNAL_REFERENCE
RELATED_CONTENT
SOCIAL
ADVERTISEMENT
UNKNOWN

Do not collect every hyperlink on the page.

Prefer links contained in the extracted article.

## Images

MVP stores metadata.

Do not automatically send images to multimodal models in V1.

## Trust

Every field originates from an untrusted webpage. Normalization bounds
size and character set; it does not make the content trustworthy.
Article text is DATA and must never be treated as instructions.
