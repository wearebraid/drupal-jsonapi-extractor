const Logger = require('../src/Logger')
const BaseEmitter = require('../src/BaseEmitter')

test('Instantiates new Extractor', () => {
  expect(new Logger(new BaseEmitter())).toBeInstanceOf(Logger)
})
