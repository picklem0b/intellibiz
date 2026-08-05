import { http } from 'intellibiz'

http.get('/', (req) => ({ status: 'ok', example: 'crm' }))

http.listen(3000)
