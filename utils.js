load('lodash.js');

function getOptionalValue(vari, type, defValue) {
  return typeof vari === type ? vari : defValue;
}

function toJSON(obj) {
  var r = [];

  if(_.isArray(obj)) {
    _.each(obj, function (item) { r.push(toJSON(item)); });
    return '[ ' + r.join(", ") + ' ]';
  }
  if(!(obj instanceof java.lang.String) && !(obj instanceof java.lang.Number)) {
    _.each( _.keys(obj), function (k) {
      r.push('"' + k.toString() + '" : ' + toJSON(obj[k]));
    });
    return '{ ' + r.join(", ") + ' }';
  }

  return obj;
}

function deflt(v, d) {
  return (_.isNull(v) || _.isUndefined(v)) ? d : v;
}

function nullOr(val, subst) {
  return (_.isNull(val) || _.isUndefined(val)) ? null : subst;
}

exports = module.exports = {
  "getOptionalValue": getOptionalValue,
  "toJSON": toJSON,
  "deflt": deflt,
  "nullOr": nullOr
};
