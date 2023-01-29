FROM node:16

WORKDIR /usr

COPY package.json ./

COPY tsconfig.json ./

COPY src ./src

RUN ls -a

RUN npm install

EXPOSE 30303 60606

CMD ["npm","run","dev"]