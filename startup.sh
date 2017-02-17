#! /bin/sh --

broker='amqp://guest:guest@localhost:5672/?heartbeat=120'
#elasticsearch='http://do-tsm-es-02.do.viaa.be:9200/node-workers/'
elasticsearch='http://do-mgm-lst-01.do.viaa.be:9200/kranten/'

function run_listener () {
	nodemon ./src/listeners/${1} \
		--broker="${broker}" \
		--listenqueue=${2} \
		--replyqueue=${3} \
		--elasticsearch=${elasticsearch} \
		--durable --verbose --pretty &
}

run_listener unzip-listener unzip_requests unzip_responses
