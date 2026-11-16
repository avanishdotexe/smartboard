# SmartBoard ko database ke saath live karna (free)

Kul teen kaam: (A) MongoDB Atlas database, (B) GitHub par code, (C) Render par deploy.

## A. MongoDB Atlas (free database)
1. mongodb.com/atlas par jao, **Try Free**, Google se sign up karo.
2. **Create** > **Free (M0)** cluster chuno. Provider AWS, region **Mumbai (ap-south-1)**. Name kuch bhi. **Create Deployment**.
3. Jo "Connect to your cluster" screen aaye usme **Database user** banao: username `smartboard`, ek strong password banao aur **password kahin copy kar lo**. (Password me `@` `:` `/` jaise special character mat rakhna.)
4. **Network Access** (left menu) > **Add IP Address** > **Allow access from anywhere** (`0.0.0.0/0`) > Confirm. (Render ka IP badalta rehta hai, isliye ye zaroori hai.)
5. **Database** (left menu) > apne cluster par **Connect** > **Drivers** > Node.js. Ek string dikhegi:
   `mongodb+srv://smartboard:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   Isme `<db_password>` ki jagah apna asli password daal do. Ye hi tumhara **MONGODB_URI** hai.

## B. GitHub
1. github.com par naya **Public** repo `smartboard` banao (README mat add karna).
2. **uploading an existing file** se is folder ki saari files daalo. `node_modules` aur `data` mat daalna. **Commit changes**.

## C. Render
1. render.com par GitHub se login. **New + > Blueprint** > apna repo > **Connect**.
2. Render `MONGODB_URI` maangega. Part A wali poori string paste karo. `JWT_SECRET` apne aap ban jayega.
3. **Apply**. 3-4 minute baad logs me ye line dikhni chahiye:
   `Storage: mongo. Loaded 0 saved board(s).`
   Agar `Storage: file` dikhe to MONGODB_URI nahi lagi. Render > service > **Environment** me jaake daalo aur Save karo.
4. Link kholo, **Teacher login > Create an account** se signup karo. Board banao. Render ko **Manual Deploy > Restart** karke dekho, board "My boards" me bacha rehna chahiye.

## Kaise kaam karta hai
- Student ko login nahi chahiye, wo code se join karta hai.
- Teacher login karke board banata hai to wo uske account me jud jata hai aur kabhi expire nahi hota. Bina login wale board 7 din baad hat jaate hain.
- Teacher kisi bhi device se "My boards" me apne board khol sakta hai.
- Passwords hashed (scrypt) save hote hain, plain text nahi.

## Dhyan rakhna
- Free Render 15 min baad so jata hai (pehli baar kholne me ~50 sec).
- `MONGODB_URI` aur password kisi ko mat dikhana aur GitHub par mat daalna.
- Video class kuch networks par TURN server ke bina nahi judti.
- Bina `MONGODB_URI` ke app local files (`data/`) use karta hai, isliye laptop par `npm install && npm start` pehle jaisa chalta hai.

## Docker
`docker build -t smartboard . && docker run -p 80:3000 -e PORT=3000 -e MONGODB_URI="..." -e JWT_SECRET="kuch-lamba-random" smartboard`
