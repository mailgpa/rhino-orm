The *quick and ditry* JavaScript wrapper for the popular Java ORM library [Hibernate] to be used in [Rhino] scripts.

Inspired by [ringo-hibernate](https://github.com/robi42/ringo-hibernate) package for [RingoJS](http://ringojs.org/)

##Requirements

* [Rhino]
* [Hibernate] in CLASSPATH
* [Lo-Dash](http://lodash.com/) - *"A drop-in replacement for [Underscore.js] , from the devs behind [jsPerf.com](http://jsPerf.com/)"*
* or [Underscore.js](http://underscorejs.org/) - *"A utility-belt library for JavaScript that provides a lot of the functional programming support"*


##Examples

###Initializing ORM object:

```javascript
load('lodash.js');

var ORM = require('orm'),
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