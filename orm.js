/*
 * JS Wrapper for Hibernate
 */

function deflt(v, d) {
  return (_.isNull(v) || _.isUndefined(v)) ? d : v;
}

function init(config) {
  var t = this;

  try {
    var c = t.configuration = new org.hibernate.cfg.Configuration();
    _.each(config.config, function(v, k) {
      c.setProperty(k, v);
    });
    _.each(config.resources, function(res) {
      c.addResource(res);
    });
    t.sessionFactory = c.buildSessionFactory();
  } catch (error) {
    throw error;
  }

  return t;
}

function getSession() {
  var t = this;
  if (!t.sessionFactory || t.sessionFactory.isClosed()) { t.init(t.config); }
  return t.sessionFactory.openSession();
}

// Prepare simple metadata definition for the given entity
function getMappings(entityName, session, mappings, configuration) {
  if (mappings[entityName]) return mappings[entityName];

  var result = {},
  cmd = session.getSessionFactory().getClassMetadata(entityName),
  iterator = java.util.Arrays.asList(cmd.getPropertyNames()).iterator(),
  idName = cmd.getIdentifierPropertyName(), cm;

  if (configuration) cm = configuration.getClassMapping(entityName);

  if (idName) {
    result[idName] = result[idName] || {};
    result[idName].id = true;
    result[idName].type = cmd.getIdentifierType().getName();
  }

  while (iterator.hasNext()) {
    var p = iterator.next(),
    ptype = cmd.getPropertyType(p),
    ptname = ptype.getName(),
    pcoliterator = cm.getProperty(p).getColumnIterator(),
    pcol;

    result[p] = result[p] || {};

    if (ptype.isAssociationType()) {
      // Association
      pcol = pcoliterator.next();
      result[p]['not-null'] = !(pcol.isNullable());

      if (ptype.isCollectionType()) {
        result[p].type = 'to-many';
        result[p].entity = ptname;
      } else {
        result[p].type = 'to-one';
        result[p].entity = ptname;
      }
      if (ptype.getForeignKeyDirection().equals(org.hibernate.type.ForeignKeyDirection.FOREIGN_KEY_TO_PARENT)) {
        result[p].direction = 'to-parent';
      } else if (ptype.getForeignKeyDirection().equals(org.hibernate.type.ForeignKeyDirection.FOREIGN_KEY_FROM_PARENT)) {
        result[p].direction = 'from-parent';
      }
    } else {
      // Scalar property
      result[p].type = ptname;
      if (configuration) {
        pcol = pcoliterator.next();
        result[p].defval = pcol.getDefaultValue();
        result[p]['not-null'] = !(pcol.isNullable());
      }
    }
  }

  mappings[entityName] = result;
  return result;
}

// Get metadata by entity name
function getMeta(entityName) {
  var t = this;
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

// Get Hibernate Criteria object by it's JS representation
function getCriteria(root, path, filter, entityName) {
  var m, criteria = root.createCriteria(path),
  t = this, M = getMeta.call(t, entityName),
  R = org.hibernate.criterion.Restrictions,
  O = org.hibernate.criterion.Order;

  _.each((filter || {}), function (f, k) {
    if (k.match(/^(eq|ne|lt|le|gt|ge|like)$/)) {
      _.each((f || {}), function (val, prop) {
        criteria.add( R[k](prop, getProperty.call(t, M[prop].type, val)) );
      });
      return;
    }
    if (k.match(/^in:(.*)$/)) {
      var m = k.match(/^in:(.*)$/),
      type = M[m[1]].entity;
      getCriteria.call(t, criteria, m[1], filter[key], type, mappings);
      return;
    }
    if (key.match(/^(asc|desc)$/)) {
      _.each(([]).concat(filter[key]), function (prop) {
        criteria.addOrder( O[key](prop) );
      });
      return;
    }
  });

  return criteria;
}

// Convert JS value to Java type
function getProperty(typeName, val) {
  if (deflt(typeName, '').match(/^(long|short|integer|float|double|string|boolean|byte)$/)) {

    if (_.isNull(val) || _.isUndefined(val)) return null;
    var nType = typeName.substr(0,1).toUpperCase() + typeName.substr(1).toLowerCase();
    return java.lang[nType]( val.toString() );
  }

  return val;
}

// "Convert" plain JS object to Hibernate data-map object
function getEntity(entityName, data) {
  if (!data) return {};

  var t = this,
  r = [], M = t.getMeta(entityName);

  _.each(([]).concat(data), function(obj) {
    var rItem = {};

    _.each(M, function (v, p) {
      if (v.type == 'to-many') {
        // Collection
        rItem[p] = rItem[p] || [];
        _.each(([]).concat(obj[p]), function (item) {
          rItem[p].push(t.getEntity(v.entity, item));
        });
      } else if (v.type == 'to-one') {
        // Single association
        rItem[p] = t.getEntity(v.entity, obj[p]);
      } else {
        // Scalar property
        rItem[p] = getProperty(v.type, obj[p]);
      }
    });

    r.push(rItem);
  });

  return _.isArray(data) ? r : r[0];
}

// Java-to-JS wrapper mostly to avoid cyclic references
function getResult(obj, _stack) {
  var result,
  stack = _.clone(deflt(_stack, {})),
  t = this;

  if (obj instanceof java.util.Collection) {
    return function(o) {
      var result = [],
      iterator = o.iterator();

      while (iterator.hasNext()) {
        result.push(getResult.call(t, iterator.next(), stack));
      }

      return result;
    }(obj);
  } else if (obj instanceof java.util.Map) {
    return function(o) {
      var result = {},
      type, M;

      if (o.containsKey('$type$')) {
        type = o.get('$type$');
        M = t.getMeta(type);
        stack[type] = 1;
      }

      var iterator = o.keySet().iterator();

      while (iterator.hasNext()) {
        var prop = iterator.next();
        if (prop != '$type$') {
          if (M[prop] && M[prop].type.match(/^to-(one|to-many)$/)) {
            if (stack[M[prop].entity] && M[prop].direction == 'to-parent') {
              result[prop] = {};
            } else { result[prop] = getResult.call(t, o.get(prop), stack); }
          } else result[prop] = getResult.call(t, o.get(prop), stack);
        }
      }

      return result;
    }(obj);
  }

  return obj;
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
function sessionWrapper(func) {
  var t = this, session, result;

  try {
    t.session = session = getSession.call(t);
    result = transactionWrapper.call(t, session, function (session, tx) {
      return getResult.call(t, func.call(t, session, tx));
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
function entityWrapper(entityName, _data, func) {
  var t = this,
  data = getEntity.call(t, entityName, _data);
  return sessionWrapper.call(t, function (session) {
    return func.call(t, session, entityName, data);
  });
}

// Wrap a function call into a Hibernate session/transaction,
// resolving given data into a Hibernate Criteria object
function criteriaWrapper(entityName, filter, session, func) {
  var t = this;
  return func.call(t, t.getCriteria(session, entityName, filter, entityName));
}

// Helpers

// Make a Hibernate Criteria query by given entity name & filter
function criteriaQuery(entityName, filter) {
  var t = this;
  return sessionWrapper.call(t, function (session) {
    return criteriaWrapper.call(t, entityName, filter, session, function (criteria) {
      return criteria.list();
    });
  });
}

// Delete Hibernate object by given entity name & filter
function criteriaDelete(entityName, filter) {
  var t = this;
  return t.sessionWrapper(function (session) {
    return t.criteriaWrapper(entityName, filter, session, function (criteria) {
      var rs = criteria.list().iterator();
      while (rs.hasNext()) {
        criteria.getSession()['delete'](entityName, rs.next());
      }
    });
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
  criteriaWrapper : criteriaWrapper,

  // Helpers
  criteriaQuery   : criteriaQuery,
  criteriaDelete  : criteriaDelete
};

module.id = "orm";