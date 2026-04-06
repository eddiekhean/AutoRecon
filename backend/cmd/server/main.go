package main

import (
    "log"

    "github.com/gin-gonic/gin"
)

func main() {
    log.Println("Starting AutoRecon API Server...")

    r := gin.Default()

    // Health check endpoint
    r.GET("/api/v1/health", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "status": "UP",
            "message": "AutoRecon Backend is running",
        })
    })

    // Placeholder for other routes: Auth, Orders, Transactions, Reconciliation

    if err := r.Run(":8080"); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
