This as the JavaScript wrapper for the popular Java ORM library [Hibernate](http://hibernate.org/) to be used in [Rhino](https://developer.mozilla.org/en-US/docs/Rhino) scripts.

##Examples

```javascript
var ORM = require('orm'),
orm = new ORM({
  config: {
    "hibernate.connection.driver_class": "org.h2.Driver",
    "hibernate.connection.url": "jdbc:h2:db/test;AUTO_SERVER=TRUE",
    "hibernate.connection.username": "sa",
    "hibernate.connection.password": "",
    "hibernate.show_sql": "true",
    "hibernate.hbm2ddl.auto": "update",
  },
  resources: ['mappings.hbm.xml']
});
```