const transformer = require('../src/Transformer')

test('Instantiates new Extractor', () => {
  expect(typeof transformer()).toBe("function")
})
