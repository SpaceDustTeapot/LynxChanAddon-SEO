This addon provides SEO optimizations.
To configure board descriptions for SEO, create a file named descriptions on the dont-reload directory with descriptions divided by lines.
Each line should be in the following format
b, a description
Anything before the first comma will be used as the board uri and anything after as the description. Any extra comma will be ignored as any excessive spaces.
The following
  b  ,  a description
will result in the exact same effect as the former example.