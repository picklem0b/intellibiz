import { http } from 'intellibiz'

http.get('/', (req) => ({ status: 'ok', example: 'websocket-chat' }))

http.listen(3000)
