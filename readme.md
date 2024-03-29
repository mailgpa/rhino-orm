The *quick and dirty* JavaScript wrapper for the popular Java ORM library [Hibernate] to be used in [Rhino] scripts.

Inspired by [ringo-hibernate](https://github.com/robi42/ringo-hibernate) package for [RingoJS](http://ringojs.org/)

##Requirements

* [Rhino] - *"Rhino is an open-source implementation of JavaScript written entirely in Java"*
* *or* [vert.x] - *"Effortless asynchronous application development for the modern web and enterprise"*
* *or* [RingoJS] - *"Ringo is a CommonJS-based JavaScript runtime written in Java and based on the Mozilla Rhino JavaScript engine."*
* [Hibernate] in CLASSPATH

##Examples

###Initializing ORM object:

```javascript
var ORM = require('orm').ORM,
orm = new ORM({
  // Hibernate configuration options
  config: {
    "hibernate.connection.driver_class": "org.h2.Driver",
    "hibernate.connection.url": "jdbc:h2:db/test;AUTO_SERVER=TRUE",
    "hibernate.connection.username": "sa",
    "hibernate.connection.password": "",
    "hibernate.show_sql": "true",
    "hibernate.hbm2ddl.auto": "update",
  },
  // HBM mappings from CLASSPATH
  resources: ['mappings.hbm.xml']
});
```
###Persisting object:

```javascript
var result = orm.entityWrapper('City', {'name': 'Lipetsk', 'area': 'Lipetskaya obl.'}, function (session, data) {
  return session.merge(data);
});
```

##To-Do

* Tests!

##License and Contact

**License:** MIT (http://www.opensource.org/licenses/mit-license.php)

Pavel Goloborodko<br>
https://github.com/mailgpa<br>
mailgpa@gmail.com

  [Rhino]: https://developer.mozilla.org/en-US/docs/Rhino
  [Hibernate]: http://hibernate.org/
  [Underscore.js]: http://underscorejs.org/
  [vert.x]: http://vertx.io/
  [RingoJS]: http://ringojs.org/
