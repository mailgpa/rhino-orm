load('underscore.js');

var utils = require('utils');

function getCriteria(root, path, filter, entityName) {
  var m, criteria = root.createCriteria(path),
  t = this, M = t.getMeta(entityName),
  R = org.hibernate.criterion.Restrictions,
  O = org.hibernate.criterion.Order;

  _.each((filter || {}), function (f, k) {
    if (k.match(/^(eq|ne|lt|le|gt|ge|like)$/)) {
      _.each((f || {}), function (val, prop) {
        criteria.add( R[k](prop, getProperty(M[prop].type, val)) );
      });
      return;
    }
    if (k.match(/^in:(.*)$/)) {
      var m = k.match(/^in:(.*)$/),
      type = M[m[1]].entity;
      getCriteria(criteria, m[1], filter[key], type, mappings);
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

function getProperty(typeName, val) {
  if (utils.deflt(typeName, '').match(/^(long|short|integer|float|double|string|boolean|byte)$/)) {

    if (_.isNull(val) || _.isUndefined(val)) return null;
    var nType = typeName.substr(0,1).toUpperCase() + typeName.substr(1).toLowerCase();
    return java.lang[nType]( val.toString() );
  }

  return val;
}

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

function getEntity(entityName, obj) {
  if (!obj) return {};

  var t = this,
  r = {}, M = t.getMeta(entityName);

  _.each(M, function (v, p) {
    if (v.type == 'to-many') {
      // Collection
      r[p] = r[p] || [];
      _.each(([]).concat(obj[p]), function (item) {
        r[p].push(t.getEntity(v.entity, item));
      });
    } else if (v.type == 'to-one') {
      // Single association
      r[p] = t.getEntity(v.entity, obj[p]);
    } else {
      // Scalar property
      r[p] = getProperty(v.type, obj[p]);
    }
  });

  return r;
}

function getResult(obj, _stack) {
  var result,
  stack = _.clone(utils.deflt(_stack, {})),
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
}

function getSession() {
  var t = this;
  if (!t.sessionFactory || t.sessionFactory.isClosed()) { t.init(t.config); }
  return t.sessionFactory.openSession();
}

function sessionWrapper(func) {
  var t = this;
  var session, result;

  try {
    t.session = session = t.getSession();
    result = transactionWrapper(session, function (session, tx) {
      return func(session, tx);
    });
  } catch (error) {
    throw error;
  } finally {
    if (session && session.close) session.close();
  }

  return result;
}

function transactionWrapper(session, func) {
  var tx, result;

  try {
    tx = session.beginTransaction();
    result = func(session, tx);
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

function criteriaQuery(entityName, filter) {
  var t = this;
  return t.sessionWrapper(function (session) {
    return t.criteriaWrapper(entityName, filter, session, function (criteria) {
      return t.getResult(criteria.list());
    });
  });
}

function criteriaWrapper(entityName, filter, session, func) {
  var t = this;
  return func(t.getCriteria(session, entityName, filter, entityName));
}

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

function ORM(config) {
  this.init(config);
}

ORM.prototype = {
  init: init,
  sessionWrapper: sessionWrapper,
  criteriaWrapper: criteriaWrapper,
  criteriaQuery: criteriaQuery,
  criteriaDelete: criteriaDelete,
  getEntity: getEntity,
  getResult: getResult,
  getSession: getSession,
  getCriteria: getCriteria,
  getMeta: function (entityName) {
    var t = this;
    t.mappings = t.mappings || {};

    if (t.session && t.session.isOpen()) return getMappings(entityName, t.session, t.mappings, t.configuration);

    return t.sessionWrapper(function (session) {
      return getMappings(entityName, session, t.mappings, t.configuration);
    });
  }
};

exports.ORM = ORM;
