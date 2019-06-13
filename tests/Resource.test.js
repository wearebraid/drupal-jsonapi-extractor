const Resource = require('../src/Resource')

test('Instantiates new Extractor', () => {
  expect(new Resource({links: {self: { href: 'http://www.example.org/'}}})).toBeInstanceOf(Resource)
})
