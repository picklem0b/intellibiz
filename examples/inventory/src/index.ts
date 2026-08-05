import { http } from 'intellibiz'

http.get('/', (req) => ({ status: 'ok', example: 'inventory' }))

http.listen(3000)
