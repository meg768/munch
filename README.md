# Munch


## Running with **forever**

	$ sudo forever start munch.js {script} [options]

## Install with **forever-service**

	$ sudo forever-service install munch-download-ticks --script ./munch.js --scriptOptions " download-ticks --schedule '00 03 * * *'" --start
	$ sudo forever-service install munch-backup   --script ./munch.js --scriptOptions " backup --schedule '00 01 * * *' --password XXX" --start

## Controlling the service

	$ sudo service {service-name} stop

## Display running services
	$ sudo forever list

## Delete service
	$ sudo forever-service delete {service-name}

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
