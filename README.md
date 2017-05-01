# Munch

## Install with **pm2**

	$ sudo pm2 start app.js --name munch-download-ticks -- download-ticks --schedule "00 03 * * *"
	$ sudo pm2 start app.js --name munch-download-quotes -- download-quotes --schedule "00 07 * * *"
	$ sudo pm2 start app.js --name munch-backup -- backup --schedule "00 09 * * 6"


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
