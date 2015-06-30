'use strict';

/* global chai: false */

var expect = chai.expect;

describe('The Calendar Angular module controllers', function() {

  var newDate = 'newDate';
  var newEndDate = 'newEndDate';
  var event;
  var liveNotification;

  beforeEach(function() {
    event = {};

    var calendarUtilsMock = {
      getNewDate: function() {
        return newDate;
      },
      getNewEndDate: function() {
        return newEndDate;
      }
    };

    var calendarServiceMock = {
      calendarId: '1234',
      shellToICAL: function(e) {
        event = e;
      },
      create: function() {
        return {
          then: function() {
            return {
              finally: function() {}
            };
          }
        };
      },
      icalToShell: function(event) {
        return event;
      }
    };

    var sessionMock = {
      user: 'aUser'
    };

    var liveNotificationMock = function(namespace) {
      if (liveNotification) {
        return liveNotification(namespace);
      }
      return {
        on: function() {}
      };
    };

    this.uiCalendarConfig = {
      calendars: {
        calendarId: {
          fullCalendar: function() {
          },
          offset: function() {
            return {
              top: 1
            };
          }
        }
      }
    };

    this.localEventSourceMock = {
      getEvents: {}
    };

    var self = this;
    angular.mock.module('esn.calendar');
    angular.mock.module('ui.calendar', function($provide) {
      $provide.constant('uiCalendarConfig', self.uiCalendarConfig);
    });
    angular.mock.module(function($provide) {
      $provide.value('calendarUtils', calendarUtilsMock);
      $provide.value('calendarService', calendarServiceMock);
      $provide.value('session', sessionMock);
      $provide.value('livenotification', liveNotificationMock);
      $provide.value('calendarService', calendarServiceMock);
      $provide.value('localEventSource', self.localEventSourceMock);
      $provide.factory('calendarEventSource', function() {
        return function() {
          return [{
            title: 'RealTest',
            location: 'Paris',
            description: 'description!',
            allDay: false,
            start: new Date(),
            attendeesPerPartstat: {
              'NEEDS-ACTION': []
            }
          }];
        };
      });
    });
  });

  beforeEach(angular.mock.inject(function($controller, $rootScope, $compile, $timeout, $window, USER_UI_CONFIG) {
    this.rootScope = $rootScope;
    this.scope = $rootScope.$new();
    this.controller = $controller;
    this.$compile = $compile;
    this.$timeout = $timeout;
    this.$window = $window;
    this.USER_UI_CONFIG = USER_UI_CONFIG;
  }));

  describe('The eventFormController controller', function() {

    beforeEach(function() {
      this.eventFormController = this.controller('eventFormController', {
        $rootScope: this.rootScope,
        $scope: this.scope
      });
    });

    describe('initFormData function', function() {
      it('should initialize the scope with a default event if $scope.event does not exist', function() {
        this.eventFormController.initFormData();
        var expected = {
          startDate: newDate,
          endDate: newEndDate,
          allDay: false
        };
        expect(this.scope.editedEvent).to.deep.equal(expected);
        expect(this.scope.event).to.deep.equal(expected);
      });

      it('should initialize the scope with $scope.event if it exists', function() {
        this.scope.event = {
          _id: '123456',
          startDate: new Date(),
          endDate: new Date(),
          allDay: false,
          otherProperty: 'aString'
        };
        this.eventFormController.initFormData();
        expect(this.scope.editedEvent).to.deep.equal(this.scope.event);
      });
    });

    describe('modifyEvent function', function() {
      it('should display an error if the edited event has no title', function(done) {
        var $alertMock = function(alertObject) {
          expect(alertObject.show).to.be.true;
          expect(alertObject.content).to.equal('You must define an event title');
          done();
        };
        this.eventFormController = this.controller('eventFormController', {
          $rootScope: this.rootScope,
          $scope: this.scope,
          $alert: $alertMock
        });

        this.scope.editedEvent = {};
        this.eventFormController.modifyEvent();
      });

      it('should not send modify request if no change', function(done) {
        this.scope.createModal = {
          hide: function() {
            done();
          }
        };
        this.eventFormController = this.controller('eventFormController', {
          $rootScope: this.rootScope,
          $scope: this.scope
        });

        this.scope.event = {
          startDate: new Date(),
          endDate: new Date(),
          allDay: false,
          title: 'title'
        };
        this.scope.editedEvent = this.scope.event;
        this.eventFormController.modifyEvent();
      });
    });

    describe('addNewEvent function', function() {
      it('should force title to \'No title\' if the edited event has no title', function() {
        this.eventFormController = this.controller('eventFormController', {
          $rootScope: this.rootScope,
          $scope: this.scope
        });

        this.scope.editedEvent = {};
        this.eventFormController.addNewEvent();
        expect(event).to.deep.equal({
          title: 'No title',
          organizer: 'aUser'
        });
      });
    });

  });

  describe('The calendarController controller', function() {

    beforeEach(function() {
      this.scope.uiConfig = this.USER_UI_CONFIG;
      this.scope.calendarId = 'calendarId';
    });

    it('should be created and its scope initialized', function() {
      this.controller('calendarController', {$scope: this.scope});
      expect(this.scope.uiConfig.calendar.eventRender).to.equal(this.scope.eventRender);
      expect(this.scope.uiConfig.calendar.eventAfterAllRender).to.equal(this.scope.resizeCalendarHeight);
    });

    it('The eventRender function should render the event', function() {
      this.controller('calendarController', {$scope: this.scope});
      var uiCalendarDiv = this.$compile(angular.element('<div ui-calendar="uiConfig.calendar" ng-model="eventSources"></div>'))(this.scope);

      uiCalendarDiv.appendTo(document.body);
      this.scope.$apply();
      this.$timeout.flush();

      var weekButton = uiCalendarDiv.find('.fc-agendaWeek-button');
      expect(weekButton.length).to.equal(1);
      var dayButton = uiCalendarDiv.find('.fc-agendaDay-button');
      expect(dayButton.length).to.equal(1);

      var checkRender = function() {
        var title = uiCalendarDiv.find('.fc-title');
        expect(title.length).to.equal(1);
        expect(title.hasClass('ellipsis')).to.be.true;
        expect(title.text()).to.equal('RealTest (Paris)');

        var eventLink = uiCalendarDiv.find('a');
        expect(eventLink.length).to.equal(1);
        expect(eventLink.hasClass('event-common')).to.be.true;
        expect(eventLink.attr('title')).to.equal('description!');
      };

      checkRender();
      weekButton.click();
      this.scope.$apply();
      try {
        this.$timeout.flush();
      } catch (exception) {
        // Depending on the context, the 'no defered tasks' exception can occur
      }
      checkRender();
      dayButton.click();
      this.scope.$apply();
      try {
        this.$timeout.flush();
      } catch (exception) {
        // Depending on the context, the 'no defered tasks' exception can occur
      }
      checkRender();
    });

    it('should resize the calendar height twice when the controller is created', function() {
      this.controller('calendarController', {$scope: this.scope});
      var called = 0;

      var uiCalendarDiv = this.$compile(angular.element('<div ui-calendar="uiConfig.calendar" ng-model="eventSources"></div>'))(this.scope);
      this.uiCalendarConfig.calendars.calendarId.fullCalendar = function() {
        called++;
      };

      uiCalendarDiv.appendTo(document.body);
      this.$timeout.flush();
      try {
        this.$timeout.flush();
      } catch (exception) {
        // Depending on the context, the 'no defered tasks' exception can occur
      }
      expect(called).to.equal(2);
    });

    it('should resize the calendar height once when the window is resized', function() {
      this.controller('calendarController', {$scope: this.scope});
      var called = 0;

      var uiCalendarDiv = this.$compile(angular.element('<div ui-calendar="uiConfig.calendar" ng-model="eventSources"></div>'))(this.scope);
      uiCalendarDiv.appendTo(document.body);
      this.$timeout.flush();
      try {
        this.$timeout.flush();
      } catch (exception) {
        // Depending on the context, the 'no defered tasks' exception can occur
      }

      this.uiCalendarConfig.calendars.calendarId.fullCalendar = function() {
        called++;
      };

      angular.element(this.$window).resize();
      expect(called).to.equal(1);
    });

    it('should initialize a listener on event:updated ws event', function(done) {
      liveNotification = function(namespace) {
        expect(namespace).to.equal('/calendars');
        return {
          on: function(event, handler) {
            expect(event).to.equal('event:updated');
            expect(handler).to.be.a('function');
            done();
          }
        };
      };

      this.scope.uiConfig = {
        calendar: {}
      };

      this.controller('calendarController', {
        $rootScope: this.rootScope,
        $scope: this.scope
      });
    });

    describe('the event:updated ws event listener', function() {

      var wsListener;

      beforeEach(function() {
        liveNotification = function(namespace) {
          expect(namespace).to.equal('/calendars');
          return {
            on: function(event, handler) {
              expect(event).to.equal('event:updated');
              wsListener = handler;
            }
          };
        };

        this.scope.uiConfig = {
          calendar: {}
        };

        this.controller('calendarController', {
          $rootScope: this.rootScope,
          $scope: this.scope
        });
      });

      it('should add the event to localEventSource and emit addedCalendarItem on rootscope', function(done) {
        var event = {id: 'anId'};
        this.localEventSourceMock.addEvent = function() {};

        this.rootScope.$on('addedCalendarItem', function(e, data) {
          expect(data).to.deep.equal(event);
          done();
        });

        wsListener(event);
      });

      it('should add the event to localEventSource and emit addedCalendarItem on rootscope and removedCalendarItem if a previous version of the event existed', function(done) {
        var newEvent = {id: 'anId', desc: 'newText'};
        var oldEvent = {id: 'anId', desc: 'oldText'};
        this.localEventSourceMock.addEvent = function() {
          return oldEvent;
        };

        this.rootScope.$on('addedCalendarItem', function(e, data) {
          expect(data).to.deep.equal(newEvent);
        });

        this.rootScope.$on('removedCalendarItem', function(e, data) {
          expect(data).to.deep.equal(oldEvent.id);
          done();
        });

        wsListener(newEvent);
      });

    });
  });
});