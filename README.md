# Drupal JSON:API Extractor

[![CircleCI](https://circleci.com/gh/wearebraid/drupal-jsonapi-extractor.svg?style=svg)](https://circleci.com/gh/wearebraid/drupal-jsonapi-extractor)
![node](https://img.shields.io/node/v/drupal-jsonapi-extractor.svg)

This package is a Drupal [json:api](https://www.drupal.org/project/jsonapi)
client library with one primary responsibility - to crawl through a Drupal
produced json:api and save the resulting data to static json files in
directory structures to allow easy access to the files.

Why all the trouble? For Drupal sites with only hundreds or low thousands of
pages (the majority) enabling the (now core) [json:api](https://www.drupal.org/project/jsonapi)
module in conjunction with this library allows for fully static front ends.
Having a way to export all of a site's data to static json files allows
those files to be deployed, statically, along with a site's decoupled front
end.

It also presents an opportunity to transform the standard json:api output
to something a little more friendly for developers to work with. Ideally this
library is used during the static generation process.

## Getting started

Crawling all drupal nodes of a given content type with each node's associated
relationships (including [paragraphs](https://www.drupal.org/project/paragraphs))
is pretty easy.

```js
const { Spider } = require('drupal-jsonapi-extractor')

const baseURL = 'https://example.org/jsonapi/'
const spider = new Spider({ baseURL })

spider.crawl('/node/blog')
```
While the above `Spider` does crawl through an entire set of content types it does
not actually do anything with the results. This is where we introduce the
`Extractor` object.

```js
const { Spider, Extractor } = require('drupal-jsonapi-extractor')

const baseURL = 'https://example.org/jsonapi/'
const spider = new Spider({ baseURL })
const extractor = new Extractor(spider, { location: './downloads' })

spider.crawl('/node/content-type')
```

The above code will output a new `downloads` directory with the structure:

```
downloads/
  _resources/
    node/
      blog/
        0ef56bbd-b2d6-475e-8b83-e1fa9bc1e7fb.json
    paragraph/
      hero/
        425a6dc1-5158-4f12-8d54-eb8a7af369f0.json
    taxonomy_term/
      tags/
        2d850e4b-9d2f-4b8f-b1e7-ad959de8b393.json
  _slugs/
    node/
      1.json
    blogs/
      my-first-blog-post.json
```

This structure is intended to serve static sites well by allowing lookup by
the unique json:api global unique id, as well as the more traditional drupal
path (`node/1`) and a node's alias "slug" (`/blogs/my-first-blog-post`).

The extractor by default saves the exact output of the json:api. However, when
developing your decoupled front end you may prefer a slightly less verbose json
schema. This package includes a transformer that allows easily "cleaning" of the
output:

```js
const extractor = new Extractor(spider, {
  location: './downloads'
  clean: true
})
```

Sometimes it is nice to see the progress of the download process. This package
includes a console logger as well.

```js
const { Spider, Extractor, Logger } = require('drupal-jsonapi-extractor')

const baseURL = 'https://example.org/jsonapi/'
const spider = new Spider({ baseURL })
const extractor = new Extractor(spider, { location: './downloads' })
const logger = new Logger([spider, extractor])

spider.crawl('/node/content-type')
```
The logger in our example would print to the command line:

```sh
✔️  node: 1
✔️  taxonomy_term: 1
✔️  paragraph: 1
🎉   Crawl complete!
```

## Configuration options

Each of the provided classes have a number of configuration options.

### Spider

You pass options as the first argument when instantiating a new `Spider`.

```js
new Spider(options)
```

```js
{
  // (required) Should include the /jsonapi/ segment
  baseURL: 'https://example.org/jsonapi/'

  // (optional) Instance of axios with baseURL already applied
  api: axios,

  // (optional) Resource class configuration options
  resourceConfig: {
    // (optional) Array of regex that is used to determine which relationships should be crawled
    relationships: [
      // By default, only relationships that start with field_ are crawled
      new RegExp(/^field_/)
    ]
  }
}
```

### Extractor

You pass options as the second argument when instantiating a new `Extractor`.

```js
new Extractor(spider, options)
```

```js
{
  // The location to save files (will create directories automatically)
  location: './',
  
  // Should the above location be recursively deleted before saving?
  wipe: false,

  // Should the data be transformed or "cleaned" before being saved to disk?
  clean: false,

  // The function to pass each Resource through before saving it if clean is true
  // By default we use our own transform function, this function takes a number of
  // options itself, or you can choose to use your own callback altogether.
  transformer: transformer({

    // Array of regular expressions to keep or reject each key in the "attributes"
    // section of a json:api response. Matches are kept. These are the defaults.
    attributeFilters: [
      /^field_/, // Common field prefix
      /^(title|created|changed|langcode|body)$/, // Common for node entities
      /^(name|weight|description)$/, // Common for taxonomies
      /^(parent_type|parent_id)$/ // Common for paragraphs,
    ],
    
    // Same functionality as the attributeFilters but applied to the
    // "relationships" section of the json:api response.
    relationshipFilters: [
      /^field_/ // Common field prefix
    ],

    // Within each "field" we can remove certain fields we no longer want, in
    // this case properties of field that contains an object. Matches are removed.
    fieldPropertyFilters: [
      /^links$/
    ],

    // A callback that is passed a Resource object and expected to return a
    // cleaned up "fields" object. The default applies the above filters, but
    // a custom callback could be used here.
    cleanFields: callback
  })
}
```

Internally this library represents every crawled response with a `Resource`
object. If you choose to override the `transformer` callback it will be given
a `Resource` as an argument. You can read the source code for details on it's
[functionality](./src/Resource.js). If you want change the configuration options
of our transformer, you can customize it:

```js
const { Spider, Extractor, transformer } = require('drupal-jsonapi-extractor')

const baseURL = 'https://example.org/jsonapi/'
const spider = new Spider({ baseURL })
const extractor = new Extractor(spider, {
  location: './downloads'
  clean: true,
  wipe: true,
  transformer: transformer({
    attributeFilters: [
      /^custom_attribute_to_keep$/
    ]
  })
})

spider.crawl('/node/content-type')
```
## To do

Currently there is effectively no test coverage, although test files for the
classes have been written with an instantiation check in each.
