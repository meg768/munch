# Munch


## Running with **forever**

	$ sudo forever start download-quotes.js
	$ sudo forever start munch.js dtfgf --schedule "00 03 * * *"


## Install with **forever-service**

	$ sudo forever-service install download-quotes --script download-quotes.js --scriptOptions " " --foreverOptions " -w"
	$ sudo forever-service install download-ticks --script ./munch.js --scriptOptions " dtfgf --schedule '00 03 * * *'" --foreverOptions " -w"

## Controlling the service

	$ sudo service download-quotes stop
	$ sudo service download-quotes start

## Display running services
	$ sudo forever list

## Delete service
	$ sudo forever-service delete download-quotes

## Personal notes
	http://superuser.com/questions/476512/how-do-i-permanently-reset-the-time-zone-in-debian
	https://cloud.google.com/solutions/setup-mysql
	https://cloud.google.com/solutions/mysql-remote-access
	http://stackoverflow.com/questions/5218733/problems-in-connecting-to-mysql-server-error-2003-hy000
	http://unix.stackexchange.com/questions/226089/how-to-install-service-command-in-a-stable-debian
	https://support.rackspace.com/how-to/mysql-connect-to-your-database-remotely/
	https://nodejs.org/en/download/package-manager/

	https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions
	http://www.backuphowto.info/how-backup-mysql-database-automatically-linux-users
