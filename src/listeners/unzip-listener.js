const listen = require ('../utils/listener-utils').listen;
const cmdargs = require ('../utils/cmdargs');
const Unzipper = require('../utils/unzipper');
const q = require ('q');

const options = cmdargs.parse ({
    correlationProperties: ['correlation_id', 'destination_path'
    ],
    listenqueue: 'alto-requests',
    replyqueue: 'alto-replies'
});

function ensureValidRequest (data) {
    var valid = ('source_filepath' in data) && ('source_filename' in data)
        && ('correlation_id' in data);
    if ( ! valid ) {
        var err = { 'message': 'Missing properties for successful copy' };
        for ( var key in data ) {
            if ( ! data.hasOwnProperty (key) ) { console.log ('not own', key); continue; }
            err[key] = data[key];
        }
        throw err;
    }
}

listen (options, function (ch, data, response) {
    ensureValidRequest(data);

    var deferred = q.defer ();

    new Unzipper (data, { writeToDisk: true }).unzip((err, res) => {
        if (err) {
            deferred.reject(err)
        } else {
            response.destination_path = res.destination_path;
            deferred.resolve(response);
        }
    });

    return deferred.promise;
});
