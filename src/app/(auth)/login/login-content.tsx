"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginContent() {

  const router = useRouter();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  async function handleSubmit(e){
    e.preventDefault();

    const result = await signIn("credentials",{
      email,
      password,
      redirect:false
    });

    if(!result.error){
      router.push("/admin/dashboard");
    }
  }

  return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>

      <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:"10px"}}>

        <h2>EBDA3 Login</h2>

        <input
          type="email"
          placeholder="Email"
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button type="submit">
          Login
        </button>

      </form>

    </div>
  );
}