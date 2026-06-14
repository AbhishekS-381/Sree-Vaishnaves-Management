// Shared lucide mock factory for all component tests
// Returns a proper React function component for every named export
export const lucideMockFactory = () => {
  const MockIcon = () => null
  MockIcon.displayName = 'MockIcon'
  return new Proxy({ __esModule: true }, {
    get: (_target, prop) => {
      if (prop === '__esModule') return true
      if (typeof prop === 'string') return MockIcon
      return undefined
    }
  })
}
