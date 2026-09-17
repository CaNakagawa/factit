# ArticleDocument

Schema Version: 1.0

Conceptual structure:

{
  "schema_version": "1.0",
  "document": {
    "url": "",
    "domain": "",
    "title": "",
    "author": null,
    "published_at": null,
    "language": null,
    "content": "",
    "links": [],
    "images": []
  }
}

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

Potential structure:

{
  "src": "",
  "alt": "",
  "caption": ""
}

Do not automatically send images to multimodal models in V1.
