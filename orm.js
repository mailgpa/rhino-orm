/*
 * JS Wrapper for Hibernate
 */

function deflt(v, d) {
  return (v == null) ? d : v;
}

// Ideas stolen from Underscore.js -->

function isArray(obj) {
  return obj.length === +obj.length && obj.forEach;
}

function each(obj, iterator, context) {
  if (isArray(obj)) {
    obj.forEach(iterator, context);
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(function (key) {
      if (iterator.call(context, obj[key], key, obj) === {}) return;
    });
  } else {
    iterator.call(context, obj, undefined, obj);
  }
}

function extend(obj) {
  each(Array.prototype.slice.call(arguments, 1), function(source) {
    for (var prop in source) { obj[prop] = source[prop]; }
  });

  return obj;
}

// <--

function init(config) {
  var t = this;

  try {
    var c = t.configuration = new org.hibernate.cfg.Configuration();

    each(config.config, function(v, k) {
      c.setProperty(k, v);
    });

    each(config.resources, function(res) {
      c.addResource(res);
    });

    t.sessionFactory = c.buildSessionFactory();
  } catch (error) {
    throw error;
  }

  return t;
}

function getSession(interceptor) {
  var t = this;

  if (!t.sessionFactory || t.sessionFactory.isClosed()) t.init(t.config);

  return interceptor ? t.sessionFactory.withOptions().interceptor(interceptor).openSession() : t.sessionFactory.openSession();
}

// Prepare simple metadata definition for the given entity
function getMappings(entityName, session, mappings, configuration) {
  if (mappings[entityName]) return mappings[entityName];

  var result        = {},
      classMetaData = session.getSessionFactory().getClassMetadata(entityName)

  if (!classMetaData) return result;

  var idName = classMetaData.getIdentifierPropertyName();
  if (idName) result[idName] = {
    'id'   : true,
    'type' : classMetaData.getIdentifierType().getName()
  };

  // Obtain property names, types and nullabilities
  var props         = classMetaData.getPropertyNames(),
      types         = classMetaData.getPropertyTypes(),
      nullabilities = classMetaData.getPropertyNullability();

  // Iterate over properties
  props.forEach(function (prop, index) {
    var pType = types[index],
        rProp = result[prop] = {};

    rProp['not-null'] = !nullabilities[index];

    if (pType.isAssociationType()) {
      // Associations
      rProp.type   = pType.isCollectionType() ? 'to-many' : 'to-one';
      rProp.entity = pType.getAssociatedEntityName(session.getSessionFactory());
    } else {
      // Scalar
      rProp.type  = pType.getName();

      var pCol = configuration.getClassMapping(entityName).getProperty(prop).getColumnIterator().next();
      if ( pCol.getDefaultValue() )
        rProp.defval = String((pCol.getDefaultValue() || '').toString()).replace(/^["']*(.*?)['"]*$/, "$1");
    }
  });

  return mappings[entityName] = result;
}

// Get metadata by entity name
function getMeta(entityName) {
  var t = this;

  // Mappings cache
  t.mappings = t.mappings || {};

  // Return from cache
  if (t.mappings[entityName]) return t.mappings[entityName];

  // Resolve via opened session
  if (t.session && t.session.isOpen()) return getMappings.call(t, entityName, t.session, t.mappings, t.configuration);

  // Resolve via session mappings
  return sessionWrapper.call(t, function (session) {
    return getMappings.call(t, entityName, session, t.mappings, t.configuration);
  });
}

// Convert JS value to Java type
function getProperty(typeName, val) {
  if (deflt(typeName, '').match(/^(long|short|integer|float|double|string|boolean|byte)$/)) {
    if (val == null) return null;

    var nType = typeName.substr(0,1).toUpperCase() + typeName.substr(1).toLowerCase();
    return java.lang[nType]( val.toString() );
  }

  return val;
}

// Get Hibernate Criteria object by it's JS representation
function getCriteria(root, path, filter, entityName) {
  var criteria = root.createCriteria(path),
  t = this, M = getMeta.call(t, entityName),
  R = org.hibernate.criterion.Restrictions,
  O = org.hibernate.criterion.Order;

  each((filter || {}), function (f, k) {
    if (k.match(/^(eq|ne|lt|le|gt|ge|like)$/)) {
      each((f || {}), function (val, prop) {
        criteria.add( R[k](prop, getProperty.call(t, M[prop].type, val)) );
      });
      return;
    } else if (k.match(/^in:(.*)$/)) {
      var m = k.match(/^in:(.*)$/),
      type = M[m[1]].entity;
      getCriteria.call(t, criteria, m[1], filter[k], type);
      return;
    } else if (k.match(/^(asc|desc)$/)) {
      each(([]).concat(filter[k]), function (prop) {
        criteria.addOrder( O[k](prop) );
      });
      return;
    }
  });

  return criteria;
}

// "Convert" plain JS object to Hibernate data-map object
function getEntity(entityName, data, processor) {
  if (data == null) return;

  var t        = this,
      result   = [],
      metaData = getMeta.call(t, entityName);

  each(([]).concat(data), function(obj) {
    var rItem = {}, res;

    each(metaData, function (pType, pName) {
     if (obj[pName] == null) {
       rItem[pName] = obj[pName];
     } else if (pType.type == 'to-many') {
        // Collection
        rItem[pName] = rItem[pName] || [];

        each(([]).concat(obj[pName]), function (item) {
          res = getEntity.call(t, pType.entity, item, processor);
          if (res != null) rItem[pName].push( res );
        });
      } else if (pType.type == 'to-one') {
        // Single association
       rItem[pName] = getEntity.call(t, pType.entity, obj[pName], processor);
     } else {
       // Scalar property
       res = getProperty.call(t, pType.type, obj[pName]);
       if (res != null) rItem[pName] = processor ? processor.call(t, res) : res;
      }
    });

    rItem.$type$ = entityName;

    res = processor ? processor.call(t, rItem) : rItem;
    if (res != null) result.push( res );
  });

  return result.length > 1 ? result : result[0];
}

// Java-to-JS wrapper mostly to avoid cyclic references
function getResult(obj, _stack, processor) {
  var stack = extend({}, deflt(_stack, {})),
      t     = this;

  if (obj instanceof java.util.Collection) {
    return (function(o) {
      var result   = [],
          iterator = o.iterator(),
          res;

      while (iterator.hasNext()) {
        res = getResult.call(t, iterator.next(), stack, processor);
        if (res != null) result.push( res );
      }

      return processor ? processor.call(t, result) : result;
    })(obj);
  } else if (obj instanceof java.util.Map) {
    return (function(o) {
      var result = {},
          type, M, id;

      if (o.containsKey('$type$')) {
        type = o.get('$type$');
        id   = o.get('id');
        M    = t.getMeta(type);

        if ( stack[type + ':' + id] ) {
          return processor ? processor.call(t, result) : result;
        } else {
          stack[type + ':' + id] = 1;
        }
      }

      var iterator = o.keySet().iterator(),
          prop;

      while (iterator.hasNext()) {
        prop = iterator.next();
        if (prop != '$type$') {
          result[prop] = getResult.call(t, o.get(prop), stack, processor);
        } else {
          result[prop] = o.get(prop);
        }
      }

      return processor ? processor.call(t, result) : result;
    })(obj);
  }

  return (obj == null) ? null : ( processor ? processor.call(t, obj) : obj );
}

// Wrap a function call into a Hibernate transaction
function transactionWrapper(session, func) {
  var t = this,
  tx, result;

  try {
    tx = session.beginTransaction();
    result = func.call(t, session, tx);
    session.flush();
    tx.commit();
  } catch (error) {
    if (tx && tx.isActive()) {
      tx.rollback();
    }
    throw error;
  }

  return result;
}

// Wrap a function call into a Hibernate session/transaction
function sessionWrapper(func, options) {
  options = options || {};

  var t = this, session, result,
  interceptor = options.interceptor;

  try {
    t.session = session = getSession.call(t, interceptor);
    result = transactionWrapper.call(t, session, function (session, tx) {
      return func.call(t, session, tx);
    });
  } catch (error) {
    throw error;
  } finally {
    if (session && session.close) session.close();
  }

  return result;
}

// Wrap a function call into a Hibernate session/transaction,
// resolving given data into object/array acceptable by Hibernate
function entityWrapper(entityName, data, func, processor) {
  var t = this;

  return func.call(t, getEntity.call(t, entityName, data, processor));
}

// Wrap a function call into a Hibernate session/transaction,
// converting result from Java to JavaScript
function resultWrapper(func, processor) {
  var t = this;

  return getResult.call(t, func.call(t), undefined, processor);
}


// Wrap a function call into a Hibernate session/transaction,
// resolving given data into a Hibernate Criteria object
function criteriaWrapper(entityName, filter, session, func) {
  var t = this;

  return func.call(t, getCriteria.call(t, session, entityName, filter, entityName));
}

// Helpers

function criteriaPager(criteria, pager) {
  var result = {},
      P = org.hibernate.criterion.Projections;

  if ( pager ) {
    var rows = result.rows = criteria.setProjection(P.rowCount()).uniqueResult();

    criteria.setProjection( null );
    criteria.setResultTransformer( org.hibernate.Criteria.DISTINCT_ROOT_ENTITY );

    var pageSize = pager.size,
        lastPage = result.pages = Math.ceil( rows / ( pageSize || rows || 1 ) ) || 1,
        pageCur  = result.page  = ( pager.page < 1 ) ? 1 : ( pager.page > lastPage ) ? lastPage : pager.page;

    criteria.setFirstResult( pageSize ? (pageCur - 1)*pageSize : 0 );
    if (pageSize) criteria.setMaxResults( pageSize );

    // criteria.setProjection( P.distinct(P.id()) );
  }

  return result;
}

// Make a Hibernate Criteria query by given entity name & filter
function criteriaQuery(entityName, filter) {
  var t = this;

  return sessionWrapper.call(t, function (session) {
    return criteriaWrapper.call(t, entityName, filter, session, function (criteria) {
      return resultWrapper.call(t, function () {
        return criteria.list();
      });
    });
  });
}

// Delete Hibernate object by given entity name & filter
function criteriaDelete(entityName, filter) {
  var t = this;

  return sessionWrapper.call(t, function (session) {
    return criteriaWrapper.call(t, entityName, filter, session, function (criteria) {
      var rs = criteria.list().iterator();
      while (rs.hasNext()) {
        criteria.getSession()['delete'](entityName, rs.next());
      }
    });
  });
}

function put(entityName, data) {
  var t = this;

  return entityWrapper.call(t, entityName, data, function (session, data) {
    return session.merge(data);
  });
}

// Prepare new ORM object
exports.ORM = function(config) {
  init.call(this, config);
};

// Expose methods
exports.ORM.prototype = {
  // Service methods
  init            : init,
  getSession      : getSession,

  // Object wrappers
  getEntity       : getEntity,
  getResult       : getResult,
  getCriteria     : getCriteria,
  getMeta         : getMeta,

  // Functional wrappers
  sessionWrapper  : sessionWrapper,
  entityWrapper   : entityWrapper,
  resultWrapper   : resultWrapper,
  criteriaWrapper : criteriaWrapper,

  // Helpers
  criteriaPager   : criteriaPager,
  criteriaQuery   : criteriaQuery,
  criteriaDelete  : criteriaDelete,
  put             : put
};

module.id = "orm";
