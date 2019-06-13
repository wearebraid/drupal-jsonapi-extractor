/**
 * Simple utility to help us compose (in reverse)
 * @param  {[function]} fns
 */
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x)

/**
 * Array of regular expressions to test `attributes` against to determine if
 * they stay in the final output (under "fields")
 */
const attributeFilters = [
  /^field_/, // Common field prefix
  /^(title|created|changed|langcode|body)$/, // Common for node entities
  /^(name|weight|description)$/, // Common for taxonomies
  /^(parent_type|parent_id)$/ // Common for paragraphs
]

/**
 * Array of regular expressions to test `relationships` against to determine if
 * they stay in the final output (under fields)
 */
const relationshipFilters = [
  /^field_/ // Common field prefix
]

/**
 * Output for each individual field can be pretty messy in drupal, and when
 * you add on the json:api spec it can be a lot more than you need for a
 * static deployment. These filters are used to explicitly _remove_ properties
 * of fields.
 */
const fieldPropertyFilters = [
  /^links$/
]

/**
 * Filter a set of key/value pairs by regex. Only matches are kept by default,
 * you can invert this behavior by passing, false the the third (keep) argument.
 * @param {object} props
 * @param {[RegExp]} filters
 * @param {boolean} keep
 * @return {object}
 */
function filterByRegex (props, filters, keep = true) {
  return Object.keys(props)
    .filter(a => filters.some(f => f.test(a)) === keep)
    .reduce((attrs, key) => Object.assign(attrs, { [key]: props[key] }, {}), {})
}

/**
 * Given an object of attributes, which ones do we want to keep?
 *
 * @param {Resource} resource
 * @return {Resource}
 */
function cleanAttributes (resource) {
  return resource.setTransformedFields({
    ...filterByRegex(resource.attributes(), resource.transformerConfig().attributeFilters),
    ...filterByRegex(resource.relationships(), resource.transformerConfig().relationshipFilters)
  })
}

/**
 * Go through all of the transformed fields and remove any cruft.
 * @param {Resource} attributes
 * @return {Resource}
 */
function cleanProperties (resource) {
  const fields = resource.transformedFields()
  return resource.setTransformedFields(
    Object.keys(fields).reduce((filteredFields, key) => {
      const isFilterable = (typeof fields[key] === 'object' && fields[key] && !Array.isArray(fields[key]))
      return Object.assign(filteredFields, {
        [key]: isFilterable ? filterByRegex(fields[key], fieldPropertyFilters, false) : fields[key]
      })
    }, {})
  )
}

/**
 * Extend the default configuration
 */
function extendDefaultConfig (config) {
  const defaultConfig = {
    attributeFilters,
    relationshipFilters,
    fieldPropertyFilters,
    cleanFields: (resource, config) => {
      return pipe(cleanAttributes, cleanProperties)(resource).transformedFields()
    }
  }

  return Object.assign(defaultConfig, config, {
    attributeFilters: attributeFilters.concat(config.attributeFilters || []),
    relationshipFilters: relationshipFilters.concat(config.relationshipFilters || []),
    fieldPropertyFilters: fieldPropertyFilters.concat(config.fieldPropertyFilters || [])
  })
}

/**
 * Given a resource object, return a simple object of properties that should
 * actually be saved to disk.
 *
 * @param {Resource} resource
 */
module.exports = function instantiateTransformer (overrideConfig = {}) {
  const config = extendDefaultConfig(overrideConfig)

  return function defaultTransformer (resource) {
    resource.setTransformerConfig(config)
    return {
      id: resource.id(),
      entity: resource.entity(),
      bundle: resource.bundle(),
      guid: resource.data.id,
      paths: resource.slugPaths(),
      fields: config.cleanFields(resource)
    }
  }
}
