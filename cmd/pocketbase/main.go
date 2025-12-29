package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	pbhooks "github.com/superflowagent/tactivo/pkg/pb-hooks"
)

func main() {
	app := pocketbase.New()
	pbhooks.RegisterHandlers(app)
	if err := app.Start(); err != nil {
		log.Fatalln(err)
	}
}
