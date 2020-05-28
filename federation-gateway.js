const { ApolloGateway } = require('@apollo/gateway');
const { ApolloServer } = require('apollo-server');

const gateway = new ApolloGateway({
    serviceList: [
      { name: 'chirp', url: 'http://localhost:4001' },
      { name: 'author', url: 'http://localhost:4002' },
    ]
});
  
const server = new ApolloServer({ 
    gateway,
    subscriptions: false
});

server.listen(8000).then(({ url }) => {
    console.log("Gateway listening at " + url);
})