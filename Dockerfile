FROM balenalib/aarch64-debian-node:14.21-bullseye-build as builder
RUN install_packages p7zip-full git python gcc g++ ruby-dev make libx11-dev libxkbfile-dev fakeroot rpm libsecret-1-dev jq python2.7-dev python3-pip python-setuptools libudev-dev

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY tsconfig.json update-config-and-start.ts ./
RUN npm i && npx tsc update-config-and-start.ts

WORKDIR /usr/src/
COPY etcher etcher
COPY build-etcher.sh ./build-etcher.sh
#Ensure we clear the balena builder cache to fetch latest etcher
RUN chmod +x ./build-etcher.sh && ./build-etcher.sh

# runtime image

FROM balenablocks/aarch64-balena-electron-env:v1.2.9
COPY --from=builder /usr/src/etcher/dist/linux-arm64-unpacked/resources/app /usr/src/app
COPY --from=builder /usr/src/etcher/generated /usr/src/app/generated
COPY --from=builder /usr/src/etcher/node_modules/electron/ /usr/src/app/node_modules/electron

WORKDIR /usr/src/app/node_modules/.bin
RUN ln -s ../electron/cli.js electron

RUN apt-get update && apt-get install exfat-fuse lzma

COPY zram.sh /usr/src/app/
COPY screensaver_on.sh screensaver_off.sh /usr/bin/

RUN chmod +x /usr/src/app/zram.sh
RUN chmod +x /usr/bin/screensaver_off.sh
RUN chmod +x /usr/bin/screensaver_on.sh

COPY --from=builder /usr/src/app/update-config-and-start.js /usr/src/app
COPY .xinitrc /root/.xinitrc

WORKDIR /usr/src/app
# correct .elf is part of etcher-sdk since 7.4.2
#COPY start_cd.elf ./generated/modules/node-raspberrypi-usbboot/blobs/raspberrypi/start_cd.elf

CMD \
    curl -X POST --unix-socket $(echo ${DOCKER_HOST} | sed "s/unix:\/\///") http://localhost/images/prune\?dangling\=false \
	&& ./zram.sh \
	&& node /usr/src/app/update-config-and-start.js
