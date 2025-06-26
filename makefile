
build:
	cd nodejs/server && tsup 
	cd nodejs/client && tsup
	cd python && cd server && pip3 install -e . --config-settings editable_mode=compat

web:
	cd web && npm run start