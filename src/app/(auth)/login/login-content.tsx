"use client";

import { useState } from "react";

export default function LoginContent() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>
      
      <form style={{width:"300px",display:"flex",flexDirection:"column",gap:"10px"}}>

        <h2>EBDA3 Login</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button type="submit">
          Login
        </button>

      </form>

    </div>
  );
}