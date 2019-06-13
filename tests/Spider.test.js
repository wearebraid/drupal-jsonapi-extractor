const Spider = require('../src/Spider')

test('Requires baseURL', () => {
  expect(() => new Spider({})).toThrowError()
})

test('Instantiates with baseURL', () => {
  expect(new Spider({ baseURL: 'http://www.example.org' })).toBeInstanceOf(Spider)
})
