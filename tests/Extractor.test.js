const Extractor = require('../src/Extractor')
const BaseEmitter = require('../src/BaseEmitter')

test('Instantiates new Extractor', () => {
  expect(new Extractor(new BaseEmitter())).toBeInstanceOf(Extractor)
})
