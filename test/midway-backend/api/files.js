'use strict';

var expect = require('chai').expect;
var request = require('supertest');

describe('The files API', function() {
  var webserver, filestore;
  var domain, user, user2;
  var password = 'secret';

  beforeEach(function() {
    this.helpers.requireBackend('core/db/mongo/models/domain');
    this.helpers.requireBackend('core/db/mongo/models/user');
    filestore = this.helpers.requireBackend('core/filestore');
  });

  beforeEach(function(done) {
    var self = this;
    this.testEnv.initCore(function() {
      webserver = self.helpers.requireBackend('webserver').webserver;
      self.mongoose = require('mongoose');
      done();
    });
  });

  beforeEach(function(done) {
    this.helpers.api.applyDomainDeployment('linagora_IT', function(err, models) {
      if (err) { return done(err); }
      domain = models.domain;
      user = models.users[0];
      user2 = models.users[1];
      done();
    });
  });

  afterEach(function(done) {
    this.helpers.mongo.dropDatabase(done);
  });

  describe('POST /api/files', function() {
    it('should send back 401 when not logged in', function(done) {
      request(webserver.application).post('/api/files').expect(401).end(function(err, res) {
        expect(err).to.be.null;
        done();
      });
    });

    it('should create the file', function(done) {
      var self = this;
      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }
        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        req.query({size: 11, mimetype: 'text/plain', name: 'fname'})
           .set('Content-Type', 'text/plain')
           .send('hello world')
           .expect(201)
           .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body).to.exist;
          expect(res.body._id).to.exist;

          filestore.get(res.body._id, function(err, meta, readStream) {
            if (err) { return done(err); }
            self.helpers.api.getStreamData(readStream, function(data) {
              expect(data).to.equal('hello world');
              expect(meta.contentType).to.equal('text/plain');
              expect(meta.length).to.equal(11);
              expect(meta.filename).to.equal('fname');
              done();
            });
          });
        });
      });
    });

    it('should create the file without a name', function(done) {
      var self = this;
      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }
        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        req.query({size: 11, mimetype: 'text/plain' })
           .set('Content-Type', 'text/plain')
           .send('hello world')
           .expect(201)
           .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body).to.exist;
          expect(res.body._id).to.exist;

          filestore.get(res.body._id, function(err, meta, readStream) {
            if (err) { return done(err); }
            self.helpers.api.getStreamData(readStream, function(data) {
              expect(data).to.equal('hello world');
              expect(meta.contentType).to.equal('text/plain');
              expect(meta.length).to.equal(11);
              expect(meta.metadata).to.be.an('object');
              expect(meta.metadata.name).to.not.exist;
              done();
            });
          });
        });
      });
    });

    it('should not create the file if the size param is missing', function(done) {
      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }
        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        req.query({mimetype: 'text/plain' })
           .set('Content-Type', 'text/plain')
           .send('hello world')
           .expect(400)
           .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body).to.exist;
          expect(res.body.error).to.equal(400);
          done();
        });
      });
    });

    it('should not create the file if the mimetype param is missing', function(done) {
      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }
        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        req.query({size: 11 })
           .set('Content-Type', 'text/plain')
           .send('hello world')
           .expect(400)
           .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body).to.exist;
          expect(res.body.error).to.equal(400);
          done();
        });
      });
    });

    it('should set the current user as creator in file metadata', function(done) {
      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }
        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        req.query({size: 15, mimetype: 'text/plain', name: 'creator'})
          .set('Content-Type', 'text/plain')
          .send('testing creator')
          .expect(201)
          .end(function(err, res) {
            expect(err).to.not.exist;
            expect(res.body).to.exist;
            expect(res.body._id).to.exist;

            filestore.getMeta(res.body._id, function(err, meta) {
              if (err) { return done(err); }
              if (!meta) {
                return done(new Error('Meta should exist'));
              }

              expect(meta.metadata).to.exist;
              expect(meta.metadata.creator).to.exist;
              expect(meta.metadata.creator.objectType).to.equal('user');
              expect(meta.metadata.creator.id + '').to.equal(user.id);
              done();
            });
          });
      });
    });

    describe('When posting form-data', function() {

      it('should save the file and send back 201', function(done) {
        var self = this;
        this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
          if (err) {
            return done(err);
          }
          var req = loggedInAsUser(request(webserver.application).post('/api/files'));
          req.query({size: 11, mimetype: 'text/plain', name: 'fname'})
          .attach('file', self.testEnv.fixtures + '/hello.txt')
          .send()
          .expect(201)
          .end(function(err, res) {
            expect(err).to.not.exist;
            expect(res.body).to.exist;
            expect(res.body._id).to.exist;

            filestore.get(res.body._id, function(err, meta, readStream) {
              if (err) {
                return done(err);
              }
              self.helpers.api.getStreamData(readStream, function(data) {
                expect(data).to.equal('hello world');
                expect(meta.contentType).to.equal('text/plain');
                expect(meta.length).to.equal(11);
                expect(meta.filename).to.equal('fname');
                done();
              });
            });
          });
        });
      });

      it('should send 400 when the form does not contain attachment', function(done) {
        this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
          if (err) {
            return done(err);
          }
          var req = loggedInAsUser(request(webserver.application).post('/api/files'));
          req.query({size: 11, mimetype: 'text/plain', name: 'fname'})
            .field('username', 'Awesome')
            .send()
            .expect(400)
            .end(done);
        });
      });
    });
  });

  describe('GET /api/files/:id', function() {
    it('should send back 401 when not logged in', function(done) {
      request(webserver.application).post('/api/files').expect(401).end(function(err, res) {
        expect(err).to.be.null;
        done();
      });
    });

    it('should roundtrip the file', function(done) {
      function createFile(req, callback) {
        req.query({size: 11, mimetype: 'text/plain', name: 'fname'})
           .set('Content-Type', 'text/plain')
           .send('hello world')
           .expect(201)
           .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body).to.exist;
          expect(res.body._id).to.exist;
          callback(res.body._id);
        });
      }
      function getFile(req, callback) {
        req.expect(200, 'hello world').end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.get('Content-Disposition')).to.equal('inline; filename="fname"');
          expect(res.get('Content-Type')).to.have.string('text/plain'); // accept charset
          expect(res.get('Content-Length')).to.exist;
          expect(res.get('Content-Length')).to.equal('11');
          callback();
        });
      }

      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }

        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        createFile(req, function(id) {
          req = loggedInAsUser(request(webserver.application).get('/api/files/' + id));
          getFile(req, done);
        });
      });
    });

    it('should return 304 if not modified', function(done) {
      function createFile(req, callback) {
        req.query({size: 11, mimetype: 'text/plain', name: 'fname'})
           .set('Content-Type', 'text/plain')
           .send('hello world')
           .expect(201)
           .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.body).to.exist;
          expect(res.body._id).to.exist;
          callback(res.body._id, res.get('Date'));
        });
      }
      function getFile(req, lastModified, callback) {
        req.set('If-Modified-Since', lastModified)
           .expect(304)
           .end(function(err, res) {
          expect(err).to.not.exist;
          expect(res.get('Content-Disposition')).to.not.exist;
          expect(res.get('Content-Type')).to.not.exist;
          expect(res.get('Content-Length')).to.not.exist;
          callback();
        });
      }

      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }

        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        createFile(req, function(id, lastModified) {
          req = loggedInAsUser(request(webserver.application).get('/api/files/' + id));
          getFile(req, lastModified, done);
        });
      });
    });
  });

  describe('DELETE /api/files/:id', function() {
    it('should 401 when not logged', function(done) {
      request(webserver.application).delete('/api/files/123').expect(401).end(function(err, res) {
        expect(err).to.be.null;
        done();
      });
    });

    it('should 204 when deleted', function(done) {

      function createFile(req, callback) {
        req.query({size: 11, mimetype: 'text/plain', name: 'fname'})
          .set('Content-Type', 'text/plain')
          .send('hello world')
          .expect(201)
          .end(function(err, res) {
            expect(err).to.not.exist;
            expect(res.body).to.exist;
            expect(res.body._id).to.exist;
            callback(res.body._id);
          });
      }

      function deleteFile(req, callback) {
        req.expect(204).end(function(err, res) {
          expect(err).to.not.exist;
          return callback();
        });
      }

      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }

        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        createFile(req, function(id) {
          req = loggedInAsUser(request(webserver.application).del('/api/files/' + id));
          deleteFile(req, done);
        });
      });
    });

    it('should 404 when not exists', function(done) {
      var ObjectId = require('mongoose').Types.ObjectId;
      function deleteFile(req, callback) {
        req.expect(404).end(function(err, res) {
          expect(err).to.not.exist;
          return callback();
        });
      }

      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }

        var req = loggedInAsUser(request(webserver.application).del('/api/files/' + new ObjectId()));
        deleteFile(req, done);
      });
    });

    it('should 403 when current user is not the file owner', function(done) {

      function createFile(req, callback) {
        req.query({size: 11, mimetype: 'text/plain', name: 'fname'})
          .set('Content-Type', 'text/plain')
          .send('hello world')
          .expect(201)
          .end(function(err, res) {
            expect(err).to.not.exist;
            expect(res.body).to.exist;
            expect(res.body._id).to.exist;
            callback(res.body._id);
          });
      }

      function deleteFile(req, callback) {
        req.expect(403).end(function(err, res) {
          expect(err).to.not.exist;
          return callback();
        });
      }

      var self = this;
      this.helpers.api.loginAsUser(webserver.application, user.emails[0], password, function(err, loggedInAsUser) {
        if (err) { return done(err); }

        var req = loggedInAsUser(request(webserver.application).post('/api/files'));
        createFile(req, function(id) {
          self.helpers.api.loginAsUser(webserver.application, user2.emails[0], password, function(err, loggedInAsUser2) {
            var req = loggedInAsUser2(request(webserver.application).del('/api/files/' + id));
            deleteFile(req, done);
          });
        });
      });
    });
  });
});
