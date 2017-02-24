var amqp = require('amqplib');
var chalk = require ('chalk');
var Logger = require ('./logger').Logger;
var q = require ('q');
var url = require('amqplib');
var URL = require('url');

(function () {

	function abortOnError (error) {
		if ( error ) {
			console.warn (error);
			process.exit ();
		}
	}

	var Connection = function Connection (options, fn) {
		this.options = options;
		this.fn = fn;

		this.conn = null;
		this.channel = null;
		this.logger = new Logger (options);

		this.connect ().catch (function (err) {
			this.logger.error ('Establishing listener failed', { error: err.message });
			console.warn (err);
		}.bind (this));
	}

	Connection.prototype.connect = function connect () {
		// amqp.connect (this.options.broker)
		return this.establishConnection ()
			.then (this.keepConnection.bind (this))
			.then (this.addConnectionListeners.bind (this))
			.then (this.createChannel.bind (this))
			.then (this.prepareQueues.bind (this))
			.then (this.startConsuming.bind (this))
	}

	Connection.prototype.establishConnection = function establishConnection (count) {
		count = count || 1;
		if ( count > this.options.reconnectLimit ) {
			this.logger.error ('Too many connection attempts. Shutting down.');
			return q.reject ('too many connect attempts');
		}
		console.log('BROKER: ', this.options.broker);

		// Parse url correctly
        var parts = URL.parse(this.options.broker, true);
        var sockopts = {};
        var protocol, fields;
        protocol = parts.protocol;
        sockopts.host = parts.hostname;
        sockopts.port = parseInt(parts.port) || ((protocol === 'amqp:') ? 5672 : 5671);
        var vhost = parts.pathname ? parts.pathname.substr(1) : null;
        var credentials = credentialsFromUrl(parts);

        var connectionObj = {
        	protocol: protocol.replace(':', ''),
			hostname: sockopts.host,
			port: sockopts.port,
			username: credentials.username,
			password: credentials.password
		};



		return amqp.connect (connectionObj).catch (function (err) {
			this.logger.warn ('connection attempt failed ...', { broker_url: this.options.broker, err: err.message });
			this.logger.warn (`retrying in ${this.options.reconnectTimeout} milliseconds (attempt ${count})`);
			console.warn (err);

			var deferred = q.defer ();
			setTimeout (function () {
				deferred.resolve (this.establishConnection (count + 1));
			}.bind (this), this.options.reconnectTimeout);

			return deferred.promise;
		}.bind (this));
	}

	Connection.prototype.reconnect = function reconnect (count) {
		amqp.connect (this.options.broker)
			.catch (function (err) {
			})
			.then (this.keepConnection.bind (this))
			.then (this.addConnectionListeners.bind (this))
			.then (this.createChannel.bind (this))
			.then (this.prepareQueues.bind (this))
			.then (this.startConsuming.bind (this));
	}

	Connection.prototype.keepConnection = function keepConnection (conn) {
		this.conn = conn;
		return conn;
	}

	Connection.prototype.keepChannel = function keepChannel (channel) {
		this.channel = channel;
		return channel;
	}

	Connection.prototype.addConnectionListeners = function addConnectionLisneners (conn) {
		conn.on ('close', function connectionClosed () {
			this.logger.warn ('Connection closed');
		}.bind (this));

		conn.on ('error', function connectionError (err) {
			this.logger.error ('Connection error', { error: err.message });
			this.logger.error (`reconnecting in ${this.options.reccconectTimeout} miliseconds.`);
			setTimeout (this.reconnect.bind (this, 1), this.options.reconnectTimeout);
		}.bind (this));

		return conn;
	}

	Connection.prototype.createChannel = function createChannel (conn) {
		return this.conn.createChannel ().then (this.keepChannel.bind (this));
	}

	Connection.prototype.prepareQueues = function prepareQueues (channel) {
		this.channel.assertQueue (this.options.listenqueue, { durable: this.options.durable });
		this.channel.assertQueue (this.options.replyqueue, { durable: this.options.durable });

		return channel;
	}

	Connection.prototype.startConsuming = function startConsuming (channel) {
		this.logger.output (
			chalk.bold (' [*] ') + chalk.gray ('Waiting for messages (%s -> %s)'),
			this.options.listenqueue, this.options.replyqueue
		);
		this.logger.output (chalk.gray ('     To exit press CTRL+C'));

		this.channel.consume (this.options.listenqueue, this.consumer.bind (this));

		return channel;
	}

	Connection.prototype.consumer = function consumer (msg) {
		var data = JSON.parse (msg.content.toString ());
        this.logger.log (`(from ${this.options.listenqueue}) Received request ...`, data);
		var response = { success: true };
		this.options.correlationProperties.forEach (function (key) {
			if ( data[key] ) { response[key] = data[key]; }
		});

		var promise;
		try { promise = q (this.fn (this.channel, data, response) || response); }
		catch (e) { promise = q.reject (e); }

		promise = promise.catch (function (err) {
			this.logger.error ('Error while processing message', { error: err.message });
			console.warn (err);

			response.success = false;
			response.error = err.message;
			return response;
		}.bind (this));
		promise = promise.finally (function (r) {
			this.logger.log (`(to ${this.options.replyqueue}) Replying with ...`, response);
		}.bind (this));

		promise = promise.then (function (res) {
			var s = this.options.pretty ?  JSON.stringify (res, null, '\t') : JSON.stringify (res);
			this.channel.sendToQueue (this.options.replyqueue, new Buffer (s));
			if ( this.options.acknowledge ) { this.channel.ack (msg); }
		}.bind (this));

		promise.catch (function (err) {
			this.logger.error ('Failed to send response', { error: err.message });
			console.warn (err);
		}.bind (this));
	};

    function credentialsFromUrl(parts) {
        var user = 'guest', passwd = 'guest';
        if (parts.auth) {
            var auth = parts.auth.split(/:(.+)/);
            user = auth[0];
            passwd = auth[1];
        }
        console.log(passwd);
        return {username: user, password: passwd };
    }



	module.exports = {
		abortOnError: abortOnError,
		listen: function listen (options, fn) { new Connection (options, fn); }
	}
} ());
